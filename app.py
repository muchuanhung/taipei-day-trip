from fastapi import *
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from database import get_connection
import json
import os
import random
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

app = FastAPI()

PAGE_SIZE = 8
JWT_SECRET = os.getenv("JWT_SECRET", "taipei-day-trip-dev-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

# TapPay：Partner Key 屬於機密，只能放伺服器端，一律從環境變數讀取
TAPPAY_PARTNER_KEY = os.getenv("TAPPAY_PARTNER_KEY", "")
TAPPAY_MERCHANT_ID = os.getenv("TAPPAY_MERCHANT_ID", "")
TAPPAY_PAY_URL = os.getenv(
	"TAPPAY_PAY_URL",
	"https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime",
)


# Static Pages 不變更
@app.get("/", include_in_schema=False)
async def index(request: Request):
	return FileResponse("./static/index.html", media_type="text/html")
@app.get("/attraction/{id}", include_in_schema=False)
async def attraction(request: Request, id: int):
	return FileResponse("./static/attraction.html", media_type="text/html")
@app.get("/booking", include_in_schema=False)
async def booking(request: Request):
	return FileResponse("./static/booking.html", media_type="text/html")
@app.get("/thankyou", include_in_schema=False)
async def thankyou(request: Request):
	return FileResponse("./static/thankyou.html", media_type="text/html")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
	return FileResponse("./static/images/favicon.svg", media_type="image/svg+xml")

# 錯誤回應
def error_response(status_code: int, message: str):
	return JSONResponse(
		status_code=status_code,
		content={"error": True, "message": message},
	)

def hash_password(password: str) -> str:
	return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
	return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user: dict) -> str:
	payload = {
		"id": user["id"],
		"name": user["name"],
		"email": user["email"],
		"exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
	}
	return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict | None:
	try:
		return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
	except Exception:
		return None

# upsert
def get_user_from_auth(authorization: str | None) -> dict | None:
	if not authorization or not authorization.startswith("Bearer "):
		return None
	token = authorization.removeprefix("Bearer ").strip()
	return decode_access_token(token)

# 註冊
@app.post("/api/user")
async def api_user_signup(request: Request):
	try:
		body = await request.json()
		name = (body.get("name") or "").strip()
		email = (body.get("email") or "").strip()
		password = body.get("password") or ""

		if not name or not email or not password:
			return error_response(400, "請提供完整的註冊資訊")

		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute("SELECT id FROM user WHERE email = %s", (email,))
				if cursor.fetchone():
					return error_response(400, "註冊失敗，重複的 Email 或其他原因")

				cursor.execute(
					"INSERT INTO user (name, email, password) VALUES (%s, %s, %s)",
					(name, email, hash_password(password)),
				)
				conn.commit()
			return {"ok": True}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 登入
@app.put("/api/user/auth")
async def api_user_signin(request: Request):
	try:
		body = await request.json()
		email = (body.get("email") or "").strip()
		password = body.get("password") or ""

		if not email or not password:
			return error_response(400, "請提供完整的登入資訊")

		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"SELECT id, name, email, password FROM user WHERE email = %s",
					(email,),
				)
				user = cursor.fetchone()
		finally:
			conn.close()

		if not user or not verify_password(password, user["password"]):
			return error_response(400, "登入失敗，帳號或密碼錯誤或其他原因")

		token = create_access_token(user)
		return {"token": token}
	except Exception as exc:
		return error_response(500, str(exc))

# 取得登入狀態
@app.get("/api/user/auth")
async def api_user_auth(authorization: str | None = Header(default=None)):
	try:
		if not authorization or not authorization.startswith("Bearer "):
			return {"data": None}

		token = authorization.removeprefix("Bearer ").strip()
		payload = decode_access_token(token)
		if not payload:
			return {"data": None}

		return {
			"data": {
				"id": payload.get("id"),
				"name": payload.get("name"),
				"email": payload.get("email"),
			}
		}
	except Exception:
		return {"data": None}

# 取得預定行程
@app.get("/api/booking")
async def api_booking_get(authorization: str | None = Header(default=None)):
	try:
		user = get_user_from_auth(authorization)
		if not user:
			return error_response(403, "未登入系統，拒絕存取")

		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"""
					SELECT
						a.id AS attraction_id,
						a.name AS attraction_name,
						a.address AS attraction_address,
						b.date,
						b.time,
						b.price
					FROM booking AS b
					INNER JOIN attraction AS a ON a.id = b.attraction_id
					WHERE b.user_id = %s
					""",
					(user["id"],),
				)
				row = cursor.fetchone()
				if not row:
					return {"data": None}

				images_map = fetch_images(cursor, [row["attraction_id"]])
				images = images_map.get(row["attraction_id"], [])
				booking_date = row["date"]
				if hasattr(booking_date, "isoformat"):
					booking_date = booking_date.isoformat()

				return {
					"data": {
						"attraction": {
							"id": row["attraction_id"],
							"name": row["attraction_name"],
							"address": row["attraction_address"],
							"image": images[0] if images else "",
						},
						"date": booking_date,
						"time": row["time"],
						"price": row["price"],
					}
				}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 建立或更新預定行程
@app.post("/api/booking")
async def api_booking_post(
	request: Request,
	authorization: str | None = Header(default=None),
):
	try:
		user = get_user_from_auth(authorization)
		if not user:
			return error_response(403, "未登入系統，拒絕存取")

		body = await request.json()
		attraction_id = body.get("attractionId")
		date = body.get("date")
		time = body.get("time")
		price = body.get("price")

		if not attraction_id or not date or not time or price is None:
			return error_response(400, "建立失敗，輸入不正確或其他原因")

		if time not in ("morning", "afternoon"):
			return error_response(400, "建立失敗，輸入不正確或其他原因")

		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"SELECT id FROM attraction WHERE id = %s",
					(attraction_id,),
				)
				if not cursor.fetchone():
					return error_response(400, "建立失敗，輸入不正確或其他原因")

				cursor.execute(
					"SELECT id FROM booking WHERE user_id = %s",
					(user["id"],),
				)
				existing = cursor.fetchone()

				if existing:
					cursor.execute(
						"""
						UPDATE booking
						SET attraction_id = %s, date = %s, time = %s, price = %s
						WHERE user_id = %s
						""",
						(attraction_id, date, time, price, user["id"]),
					)
				else:
					cursor.execute(
						"""
						INSERT INTO booking (user_id, attraction_id, date, time, price)
						VALUES (%s, %s, %s, %s, %s)
						""",
						(user["id"], attraction_id, date, time, price),
					)
				conn.commit()
			return {"ok": True}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 刪除預定行程
@app.delete("/api/booking")
async def api_booking_delete(authorization: str | None = Header(default=None)):
	try:
		user = get_user_from_auth(authorization)
		if not user:
			return error_response(403, "未登入系統，拒絕存取")

		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"DELETE FROM booking WHERE user_id = %s",
					(user["id"],),
				)
				conn.commit()
			return {"ok": True}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 產生訂單編號：時間戳 + 四位亂數，避免同秒多筆碰撞
def generate_order_number() -> str:
	stamp = datetime.now(timezone(timedelta(hours=8))).strftime("%Y%m%d%H%M%S")
	return f"{stamp}{random.randint(1000, 9999)}"

# 呼叫 TapPay Pay By Prime API 扣款
def pay_by_prime(prime: str, amount: int, contact: dict, details: str) -> dict:
	payload = {
		"prime": prime,
		"partner_key": TAPPAY_PARTNER_KEY,
		"merchant_id": TAPPAY_MERCHANT_ID,
		"details": details,
		"amount": amount,
		"cardholder": {
			"phone_number": contact["phone"],
			"name": contact["name"],
			"email": contact["email"],
		},
		"remember": False,
	}
	req = urllib.request.Request(
		TAPPAY_PAY_URL,
		data=json.dumps(payload).encode("utf-8"),
		headers={
			"Content-Type": "application/json",
			"x-api-key": TAPPAY_PARTNER_KEY,
		},
		method="POST",
	)
	try:
		with urllib.request.urlopen(req, timeout=20) as response:
			return json.loads(response.read().decode("utf-8"))
	except urllib.error.HTTPError as exc:
		return {"status": -1, "msg": f"TapPay 回應錯誤：{exc.code}"}
	except Exception as exc:
		return {"status": -1, "msg": f"無法連線 TapPay：{exc}"}

# 建立訂單並付款
@app.post("/api/orders")
async def api_orders_post(
	request: Request,
	authorization: str | None = Header(default=None),
):
	try:
		user = get_user_from_auth(authorization)
		if not user:
			return error_response(403, "未登入系統，拒絕存取")

		body = await request.json()
		prime = (body.get("prime") or "").strip()
		order = body.get("order") or {}
		trip = order.get("trip") or {}
		attraction = trip.get("attraction") or {}
		contact = order.get("contact") or {}

		attraction_id = attraction.get("id")
		date = trip.get("date")
		time = trip.get("time")
		price = order.get("price")
		name = (contact.get("name") or "").strip()
		email = (contact.get("email") or "").strip()
		phone = (contact.get("phone") or "").strip()

		if not prime or not attraction_id or not date or not price:
			return error_response(400, "訂單建立失敗，輸入不正確或其他原因")

		if time not in ("morning", "afternoon"):
			return error_response(400, "訂單建立失敗，輸入不正確或其他原因")

		if not name or not email or not phone:
			return error_response(400, "訂單建立失敗，輸入不正確或其他原因")

		if not TAPPAY_PARTNER_KEY or not TAPPAY_MERCHANT_ID:
			return error_response(500, "伺服器未設定 TapPay 金鑰")

		number = generate_order_number()

		conn = get_connection()
		try:
			# 步驟 1：先寫入 UNPAID 訂單，確保扣款前一定留有紀錄
			with conn.cursor() as cursor:
				cursor.execute(
					"""
					INSERT INTO orders
						(number, user_id, attraction_id, date, time, price,
						 contact_name, contact_email, contact_phone, status)
					VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'UNPAID')
					""",
					(
						number, user["id"], attraction_id, date, time, price,
						name, email, phone,
					),
				)
				order_id = cursor.lastrowid
				conn.commit()

			# 步驟 2：呼叫 TapPay 扣款
			# urllib 是阻塞式 IO，丟到 threadpool 才不會卡住整個事件迴圈
			result = await run_in_threadpool(
				pay_by_prime,
				prime,
				price,
				{"name": name, "email": email, "phone": phone},
				f"台北一日遊 {number}",
			)
			status = result.get("status", -1)
			message = result.get("msg") or ""
			rec_trade_id = result.get("rec_trade_id")

			with conn.cursor() as cursor:
				# 步驟 3：無論成敗都寫入付款紀錄
				cursor.execute(
					"""
					INSERT INTO payment (order_id, status, message, rec_trade_id, amount)
					VALUES (%s, %s, %s, %s, %s)
					""",
					(order_id, status, message[:255], rec_trade_id, price),
				)

				# 步驟 4：付款成功才標記 PAID，並清掉待預訂行程
				if status == 0:
					cursor.execute(
						"UPDATE orders SET status = 'PAID' WHERE id = %s",
						(order_id,),
					)
					cursor.execute(
						"DELETE FROM booking WHERE user_id = %s",
						(user["id"],),
					)
				conn.commit()
		finally:
			conn.close()

		return {
			"data": {
				"number": number,
				"payment": {
					"status": status,
					"message": "付款成功" if status == 0 else (message or "付款失敗"),
				},
			}
		}
	except Exception as exc:
		return error_response(500, str(exc))

# 序列化景點
def serialize_attraction(row: dict, images: list[str]) -> dict:
	return {
		"id": row["id"],
		"name": row["name"],
		"category": row["category"],
		"description": row["description"],
		"address": row["address"],
		"transport": row["transport"],
		"mrt": row["mrt"],
		"lat": float(row["lat"]),
		"lng": float(row["lng"]),
		"images": images,
	}

# 取得景點圖片
def fetch_images(cursor, attraction_ids: list[int]) -> dict[int, list[str]]:
	if not attraction_ids:
		return {}
	placeholders = ",".join(["%s"] * len(attraction_ids))
	cursor.execute(
		f"""
		SELECT attraction_id, url
		FROM attraction_image
		WHERE attraction_id IN ({placeholders})
		ORDER BY attraction_id, sort_order, id
		""",
		attraction_ids,
	)
	images_map: dict[int, list[str]] = {attraction_id: [] for attraction_id in attraction_ids}
	for row in cursor.fetchall():
		images_map[row["attraction_id"]].append(row["url"])
	return images_map

# 取得景點列表
@app.get("/api/attractions")
async def api_attractions(
	page: int = Query(..., ge=0),
	keyword: str | None = Query(None),
	category: str | None = Query(None),
):
	try:
		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				conditions = []
				params: list = []

				if category:
					conditions.append("category = %s")
					params.append(category)

				if keyword:
					conditions.append("(mrt = %s OR name LIKE %s)")
					params.extend([keyword, f"%{keyword}%"])

				where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
				offset = page * PAGE_SIZE

				cursor.execute(
					f"""
					SELECT id, name, category, description, address, transport, mrt, lat, lng
					FROM attraction
					{where_sql}
					ORDER BY id
					LIMIT %s OFFSET %s
					""",
					[*params, PAGE_SIZE + 1, offset],
				)
				rows = cursor.fetchall()
				has_more = len(rows) > PAGE_SIZE
				rows = rows[:PAGE_SIZE]
				images_map = fetch_images(cursor, [row["id"] for row in rows])

				return {
					"nextPage": page + 1 if has_more else None,
					"data": [
						serialize_attraction(row, images_map.get(row["id"], []))
						for row in rows
					],
				}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 取得景點詳情頁
@app.get("/api/attraction/{attractionId}")
async def api_attraction(attractionId: int):
	try:
		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"""
					SELECT id, name, category, description, address, transport, mrt, lat, lng
					FROM attraction
					WHERE id = %s
					""",
					(attractionId,),
				)
				row = cursor.fetchone()
				if row is None:
					return error_response(400, "景點編號不正確")

				images_map = fetch_images(cursor, [attractionId])
				return {
					"data": serialize_attraction(row, images_map.get(attractionId, [])),
				}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 取得景點MRT列表
@app.get("/api/mrts")
async def api_mrts():
	try:
		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"""
					SELECT mrt
					FROM attraction
					WHERE mrt IS NOT NULL AND mrt != ''
					GROUP BY mrt
					ORDER BY COUNT(*) DESC, mrt
					"""
				)
				return {"data": [row["mrt"] for row in cursor.fetchall()]}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

# 取得景點分類列表
@app.get("/api/categories")
async def api_categories():
	try:
		conn = get_connection()
		try:
			with conn.cursor() as cursor:
				cursor.execute(
					"""
					SELECT DISTINCT category
					FROM attraction
					ORDER BY category
					"""
				)
				return {"data": [row["category"] for row in cursor.fetchall()]}
		finally:
			conn.close()
	except Exception as exc:
		return error_response(500, str(exc))

app.mount("/static", StaticFiles(directory="static"), name="static")

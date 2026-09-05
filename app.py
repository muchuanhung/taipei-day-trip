from fastapi import *
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from database import get_connection
import os
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

app = FastAPI()

PAGE_SIZE = 8
JWT_SECRET = os.getenv("JWT_SECRET", "taipei-day-trip-dev-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7


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

from fastapi import *
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from database import get_connection

app = FastAPI()

PAGE_SIZE = 8


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

# 錯誤回應
def error_response(status_code: int, message: str):
	return JSONResponse(
		status_code=status_code,
		content={"error": True, "message": message},
	)

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

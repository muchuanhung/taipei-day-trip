"""MCP / 會員共用：token 反查、景點搜尋、建立 booking。"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone

from database import get_connection

TAIPEI_TZ = timezone(timedelta(hours=8))
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def get_user_id_from_mcp_token(token: str) -> int | None:
	"""用 MCP Bearer Token 反查 user_id。"""
	if not token:
		return None
	conn = get_connection()
	try:
		with conn.cursor() as cursor:
			cursor.execute(
				"SELECT user_id FROM mcp_token WHERE token = %s",
				(token,),
			)
			row = cursor.fetchone()
			return row["user_id"] if row else None
	finally:
		conn.close()


def search_attractions_by_keyword(keyword: str, *, limit: int = 50) -> list[dict]:
	"""對齊 GET /api/attractions 的 keyword 條件（mrt 精確 or name LIKE）。"""
	conn = get_connection()
	try:
		with conn.cursor() as cursor:
			cursor.execute(
				"""
				SELECT id, name, description
				FROM attraction
				WHERE mrt = %s OR name LIKE %s
				ORDER BY id
				LIMIT %s
				""",
				(keyword, f"%{keyword}%", limit),
			)
			return [
				{
					"id": row["id"],
					"name": row["name"],
					"description": row["description"],
				}
				for row in cursor.fetchall()
			]
	finally:
		conn.close()


def expected_price_for_time(time: str) -> int | None:
	if time == "morning":
		return 2000
	if time == "afternoon":
		return 2500
	return None


def validate_booking_input(
	attraction_id,
	date_str,
	time,
	price,
) -> bool:
	"""對齊前端：morning=2000 / afternoon=2500；日期不可為過去。"""
	try:
		attraction_id = int(attraction_id)
	except (TypeError, ValueError):
		return False

	if not isinstance(date_str, str) or not DATE_RE.match(date_str):
		return False

	try:
		booking_date = date.fromisoformat(date_str)
	except ValueError:
		return False

	today = datetime.now(TAIPEI_TZ).date()
	if booking_date < today:
		return False

	if time not in ("morning", "afternoon"):
		return False

	try:
		price = int(price)
	except (TypeError, ValueError):
		return False

	if price != expected_price_for_time(time):
		return False

	return True


def create_or_update_booking(
	user_id: int,
	attraction_id: int,
	date_str: str,
	time: str,
	price: int,
) -> bool:
	"""
	等同 POST /api/booking：每位使用者一筆，有則更新。
	回傳 False 表示景點不存在或其他失敗。
	"""
	conn = get_connection()
	try:
		with conn.cursor() as cursor:
			cursor.execute(
				"SELECT id FROM attraction WHERE id = %s",
				(attraction_id,),
			)
			if not cursor.fetchone():
				return False

			cursor.execute(
				"SELECT id FROM booking WHERE user_id = %s",
				(user_id,),
			)
			existing = cursor.fetchone()

			if existing:
				cursor.execute(
					"""
					UPDATE booking
					SET attraction_id = %s, date = %s, time = %s, price = %s
					WHERE user_id = %s
					""",
					(attraction_id, date_str, time, price, user_id),
				)
			else:
				cursor.execute(
					"""
					INSERT INTO booking (user_id, attraction_id, date, time, price)
					VALUES (%s, %s, %s, %s, %s)
					""",
					(user_id, attraction_id, date_str, time, price),
				)
			conn.commit()
			return True
	except Exception:
		conn.rollback()
		return False
	finally:
		conn.close()

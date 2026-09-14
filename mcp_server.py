"""Part 7-2：台北一日遊 MCP Server（Streamable HTTP @ /mcp/）。"""
from __future__ import annotations

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request

from mcp_ops import (
	create_or_update_booking,
	get_user_id_from_mcp_token,
	search_attractions_by_keyword,
	validate_booking_input,
)

# endpoint 會掛在 FastAPI 的 /mcp；path="/" 讓實際 URL 是 /mcp 與 /mcp/
# 關閉 DNS rebinding 限制，否則 EC2 Host 會被擋
mcp = FastMCP(
	"台北一日遊",
	stateless_http=True,
	streamable_http_path="/",
	json_response=True,
	transport_security=TransportSecuritySettings(
		enable_dns_rebinding_protection=False,
	),
)


def _bearer_token_from_context(ctx: Context) -> str | None:
	request = ctx.request_context.request
	if request is None:
		return None
	auth = request.headers.get("authorization") or request.headers.get("Authorization")
	if not auth or not auth.startswith("Bearer "):
		return None
	token = auth.removeprefix("Bearer ").strip()
	return token or None


def _user_id_from_context(ctx: Context) -> int | None:
	token = _bearer_token_from_context(ctx)
	if not token:
		return None
	return get_user_id_from_mcp_token(token)


def _booking_page_url(ctx: Context) -> str:
	request = ctx.request_context.request
	if isinstance(request, Request):
		# mount 後 path 可能是 /mcp/...，用 scheme+netloc 組站台 origin
		base = f"{request.url.scheme}://{request.url.netloc}"
		return f"{base}/booking"
	return "/booking"


@mcp.tool(
	name="搜尋台北市景點",
	description="透過關鍵字和捷運站名搜尋台北市一日旅遊的景點",
)
def search_taipei_attractions(keyword: str, ctx: Context) -> dict:
	"""參數 keyword：景點名稱或捷運站名。"""
	try:
		if _user_id_from_context(ctx) is None:
			return {"error": True}

		keyword = (keyword or "").strip()
		if not keyword:
			return {"error": True}

		data = search_attractions_by_keyword(keyword)
		return {"data": data}
	except Exception:
		return {"error": True}


@mcp.tool(
	name="預定景點導覽行程",
	description="根據景點編號、日期、時間、價格，預定一個景點導覽行程",
)
def book_attraction_tour(
	attractionId: int,
	date: str,
	time: str,
	price: int,
	ctx: Context,
) -> dict:
	"""參數：attractionId、date(YYYY-MM-DD)、time(morning|afternoon)、price。"""
	try:
		user_id = _user_id_from_context(ctx)
		if user_id is None:
			return {"error": True}

		if not validate_booking_input(attractionId, date, time, price):
			return {"error": True}

		ok = create_or_update_booking(
			user_id,
			int(attractionId),
			str(date),
			str(time),
			int(price),
		)
		if not ok:
			return {"error": True}

		booking_url = _booking_page_url(ctx)
		return {
			"ok": True,
			"message": f"台北導覽行程，預定成功，請到 {booking_url} 完成付款。",
		}
	except Exception:
		return {"error": True}


def create_mcp_asgi_app():
	"""回傳可 mount 的 Starlette ASGI app；呼叫後才能用 mcp.session_manager。"""
	return mcp.streamable_http_app()

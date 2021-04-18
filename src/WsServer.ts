import WebSocket from "ws"

export class WsServer {
	server: WebSocket.Server
	clients: Map<string, WebSocket>
	path: string

	constructor(path: string, server: WebSocket.Server, clients: Map<string, WebSocket>) {
		this.path = path
		this.server = server
		this.clients = clients
	}
}
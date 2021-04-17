import WebSocket from "ws";

export class WsServer {
	server: WebSocket.Server
	clients: Map<string, WebSocket>

	constructor(server: WebSocket.Server, clients: Map<string, WebSocket>) {
		this.server = server;
		this.clients = clients;
	}
}
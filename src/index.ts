import express, {Request, Response} from "express"
import {v4} from 'uuid'
import basicAuth from "express-basic-auth"
import * as url from "url";
import {WsServer} from "./WsServer";
import WebSocket from "ws";

const httpServer = express()
const servers: Map<string, WsServer> = new Map<string, WsServer>()
const basic = basicAuth({
	users: {admin: 'admin'},
	challenge: true
})

httpServer.get('/status/:id', basic, (request: Request, response: Response) => {
	response
		.status(200)
		.json(
			Array.from(servers.keys()).filter((path: string) => path.startsWith(`/${request.params.id}`))
		)
})

httpServer.get('/:id/:n', basic, (request: Request, response: Response) => {
	log(`Received request for ${request.url}`)
	const existingServer = servers.get(request.path);
	if (existingServer) {
		broadcast(request.path)
		log(`Opening ${request.path}`)
		response.status(200).write('Opened')
	} else {
		log(`No active on ${request.path}`)
		response.status(400).write(`No active clients on socket ${request.path}`)
	}
	response.end()
}).listen(() => log(`Http server on port 8080, ws on 3000`))

httpServer.listen(8080)

const server = httpServer.listen(3000)
server.on('upgrade', (request, socket, head) => {
	const path = url.parse(request.url).pathname;
	const wsServer: WsServer = wsServerFactory(path!);
	wsServer.server.handleUpgrade(request, socket, head, socket => {
		wsServer.server.emit('connection', socket, request)
	})
	servers.set(path!, wsServer)
})

const wsServerFactory = (path: string): WsServer => {
	const existingServer = servers.get(path);
	if (existingServer) {
		return existingServer
	}

	const wsServer: WebSocket.Server = new WebSocket.Server({noServer: true})
	let clients: Map<string, WebSocket> = new Map<string, WebSocket>()
	wsServer.on('connection', client => {
		log(`Client connected on: ${path}`)
		const id = generateId()
		clients.set(id, client)
		log(`Active connections on ${path}: ${clients.size}`)
		client.on('message', message => log(message))
		client.on('close', () => {
			log(`Client disconnected: ${path}`)
			clients.delete(id)
			log(`Active connections: ${clients.size}`)
			if (clients.size === 0) {
				log(`WsServer on ${path} has no clients, deleting`)
				servers.delete(path)
			}
		})
	})
	return new WsServer(wsServer, clients)
}

const broadcast = (path: string) => {
	log(`broadcasting: ${path}`)
	return servers.get(path)?.clients.forEach(c => c.send('open'));
}

const generateId = (): string => v4().substr(0, 8)

const log = (message: any): void => console.log(`${new Date()} ${message.toString()}`)
import express, {Request, Response} from 'express'
import {v4} from 'uuid'
import basicAuth from 'express-basic-auth'
import * as url from 'url'
import {WsServer} from './WsServer'
import WebSocket from 'ws'

const HTTP_PORT = 8081
const WS_PORT = 3001

const httpServer = express()
const servers: Map<string, WsServer> = new Map<string, WsServer>()
const clients: Map<string, WebSocket> = new Map<string, WebSocket>()
const basic = basicAuth({
	users: {admin: 'admin'},
	challenge: true
})

httpServer.get(`/status/:id`, basic, (request: Request, response: Response) => {
	response
		.status(200)
		.json(
			Array.from(clients.values()).map((c: any) => `${c.path}@${c.id}`)
		)
})

httpServer.get(`/:id/:n`, basic, (request: Request, response: Response) => {
	log(`Received request for ${request.url}`)
	const existingServer = servers.get(request.path)
	if (existingServer) {
		broadcast(request.path)
		log(`Opening ${request.path}`)
		response.status(200).write('Opened')
	} else {
		log(`No active on ${request.path}`)
		response.status(400).write(`No active clients on socket ${request.path}`)
	}
	response.end()
}).listen(() => log(`Http server on port ${HTTP_PORT}, ws on ${WS_PORT}`))

httpServer.listen(HTTP_PORT)

const server = httpServer.listen(WS_PORT)
server.on('upgrade', (request, socket, head) => {
	const path = url.parse(request.url).pathname
	const wsServer: WsServer = wsServerFactory(path!)
	wsServer.server.handleUpgrade(request, socket, head, socket => {
		wsServer.server.emit('connection', socket, request)
	})
	servers.set(path!, wsServer)
})

const wsServerFactory = (path: string): WsServer => {
	const existingServer = servers.get(path)
	if (existingServer) {
		return existingServer
	}

	const wsServer: WebSocket.Server = new WebSocket.Server({noServer: true})
	wsServer.on('connection', (client: any) => {
		client.isAlive = true
		const id = generateId()
		client.id = id
		client.path = path
		clients.set(id, client)
		log(`> Client connected @${client.id} on ${path}`)
		log(`Active connections on ${path}: ${clients.size} { ${formatClientIds(clients)} }`)
		client.on('message', (message: string) => log(message))
		client.on('close', () => {
			log(`< Client disconnected: @${client.id} ${path}`)
			clients.delete(id)
			if (clients.size === 0) {
				log(`WsServer on ${path} has no clients, deleting`)
				servers.delete(path)
			}
		})
		client.on('pong', () => {
			log(`Client @${client.id} ${path} responded with PONG`)
			client.isAlive = true
		})
	})
	return new WsServer(path, wsServer, clients)
}

const broadcast = (path: string) => {
	log(`broadcasting: ${path}`)
	return servers.get(path)?.clients.forEach(c => c.send('open'))
}

const generateId = (): string => v4().substr(0, 2)

const formatClientIds = (clients: Map<string, WebSocket>) =>
	Array
		.from(clients.values())
		.map(c => (c as any).id)
		.join(', ')

const log = (message: any): void => console.log(`${new Date().toISOString()} ${message.toString()}`)

setInterval(() => {
	Array.from(servers.values()).forEach((wsServer: WsServer) => {
		wsServer.clients.forEach((client: any) => {
			if (client.isAlive === false) {
				log(`< No answer from client @${client.id} ${wsServer.path}, terminating...`)
				client.terminate()
			}
			client.isAlive = false
			client.ping()
		})
	})
}, 10 * 1000)

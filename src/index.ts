import express from "express"
import {v4} from 'uuid'
import ws from "ws"
import basicAuth from "express-basic-auth"

const numberOfEntrances = 8
const httpServer = express()
const clients: Map<string, ws> = new Map<string, ws>()
const basic = basicAuth({
	users: {admin: 'admin'},
	challenge: true
})

httpServer.get('/:n', basic, (request, response) => {
	console.log(`Received request for ${request.url}`)
	const n: number = Number(request.params.n)
	console.log(`Number: ${n}`)
	if (n && n > 0 && n <= numberOfEntrances) {
		broadcast(n.toString())
		response.writeHead(200)
		response.write('Opened')
	} else {
		response.writeHead(400)
		response.write('Invalid entrance number')
	}
	response.end()
}).listen(() => console.log(`Http server on port 8080, ws on 3000`))

httpServer.listen(8080)

const wsServer = new ws.Server({noServer: true})
wsServer.on('connection', client => {
	const id = generateId()
	console.log(`Client connected: ${id}`)
	clients.set(id, client)
	console.log(`Active connections: ${clients.size}`)
	client.on('message', message => console.log(message))
	client.on('close', () => {
		console.log(`Client disconnected: ${id}`)
		clients.delete(id)
		console.log(`Active connections: ${clients.size}`)
	})
})

const server = httpServer.listen(3000)
server.on('upgrade', (request, socket, head) => {
	wsServer.handleUpgrade(request, socket, head, socket => {
		wsServer.emit('connection', socket, request)
	})
})

const broadcast = (message: string) => {
	clients.forEach(c => c.send(message))
}

const generateId = () => v4().substr(0, 8)

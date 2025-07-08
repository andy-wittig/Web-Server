const express = require('express');
const cors = require("cors");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const corsOptions ={
    origin: "*"
}

app.use(cors(corsOptions));

const io = new Server(httpServer, {
    cors: corsOptions
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("identify", (id) => {
        if (connectedUsers.size <= 0)
        {
            connectedUsers.set(socket.id, {userId: id, isBtnDisabled: false});
            console.log("User can press the button.");
        }
        else
        {
            connectedUsers.set(socket.id, {userId: id, isBtnDisabled: true});
            console.log("User can't press the button.");
        }
        console.log(`User ${id} connected with socket ${socket.id}`);
    });

    socket.on("disconnect", () => {
        const user = connectedUsers.get(socket.id);
        connectedUsers.delete(socket.id);
        console.log(`User ${user.userId} disconnected and removed`);
    });
});

//Get Endpoint
app.get('/api/users', (req, res) => {
    const users = Array.from(connectedUsers.values()).map(user => user.userId);
    res.json({ message: `Data from express server: ${users}`});
});

app.get('/api/data', (req, res) => {
    const socketId = req.query.socketId;
    const user = connectedUsers.get(socketId);
    res.json({ isDisabled: user.isBtnDisabled });
});

//Post Endpoint
app.post("/api/submit", (req, res) => {
    const { data } = req.body;
    res.json({ message: `Recieved data: ${data}`});
}); 

httpServer.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
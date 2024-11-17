// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const { Server } = require('socket.io');
// const { Client } = require('ssh2');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:3000",
//     methods: ["GET", "POST"],
//     allowedHeaders: ["Content-Type"], 
//     credentials: true
//   }
// });


// io.on('connection', (socket) => {
//   const sshClient = new Client();
//   let isFirstBuffer = true; // Flag to track the first buffer

//   socket.on('ssh-connect', (config) => {
//     sshClient
//       .on('ready', () => {
//         socket.emit('data', 'SSH connection established');
//         sshClient.shell((err, stream) => {
//           if (err) return socket.emit('data', `Error: ${err.message}`);

//           stream
//             .on('data', (data) => {
//             //   Skip the first buffer
//               if (isFirstBuffer) {
//                 isFirstBuffer = false;
//                 return;
//               }
            
//               console.log(data.toString());
//             //   isFirstBuffer = true;
//               socket.emit('data', data.toString())
//             })
//             .on('close', () => {
//               sshClient.end();
//               socket.emit('data', 'Connection closed');
//             });

//           socket.on('command', (command) => stream.write(command + '\n'));
          
//         });
//       })
//       .on('error', (err) => socket.emit('data', `Connection error: ${err.message}`))
//       .connect(config);
//   });

//   socket.on('disconnect', () => {
//     sshClient.end();
//   });
// });

// server.listen(4000, () => {
//   console.log('Server running on port 4000');
// });


const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const apiRoutes = require('./routes/api');
const { initiateSSHConnection } = require('./terminal/terminal'); // Import SSH handling

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"], 
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes); // API routes for login and tasks

io.on('connection', (socket) => {
  socket.on('ssh-connect', (config) => {
    initiateSSHConnection(config, socket); // SSH connection on request
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(4000, () => {
  console.log('Server is running on port 4000');
});

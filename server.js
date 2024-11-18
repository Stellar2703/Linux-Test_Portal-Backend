
// const { Server } = require('socket.io');

// const mysql = require('mysql2');

// app.use(express.json());
// app.use(cors());



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

// // server.listen(4000, () => {
// //   console.log('This is for SSH');
// // });

// // MySQL Connection
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'test',
//     password: 'test',
//     database: 'linux',
//     port: '3307',
// });

// db.connect((err) => {
//     if (err) throw err;
//     console.log('MySQL Connected...');
// });

// // Endpoint for Login and Fetch Data
// app.post('/api/login', (req, res) => {
//     const { register_number } = req.body;

//     // Fetch student details
//     const studentQuery = `SELECT * FROM student_list WHERE register_number = ?`;
//     db.query(studentQuery, [register_number], (err, studentResult) => {
//         if (err || studentResult.length === 0) return res.status(404).json({ message: 'Student not found' });

//         const student = studentResult[0];
//         const level = student.level;

//         // Fetch IP for the level
//         const levelQuery = `SELECT ip FROM level_master WHERE level = ?`;
//         db.query(levelQuery, [level], (err, levelResult) => {
//             if (err || levelResult.length === 0) return res.status(404).json({ message: 'Level IP not found' });

//             const ip = levelResult[0].ip;

//             // Fetch system user
//             const systemQuery = `SELECT * FROM system_list WHERE level = ? ORDER BY RAND() LIMIT 1`;
//             db.query(systemQuery, [level], (err, systemResult) => {
//                 if (err || systemResult.length === 0) return res.status(404).json({ message: 'System user not found' });

//                 const systemUser = systemResult[0];

//                 // Fetch tasks for the system user
//                 const taskQuery = `SELECT * FROM task_description WHERE username = ?`;
//                 db.query(taskQuery, [systemUser.username], (err, taskResult) => {
//                     if (err || taskResult.length === 0) return res.status(404).json({ message: 'Tasks not found' });

//                     const tasks = taskResult[0];
//                     res.json({ student, ip, systemUser, tasks });
//                 });
//             });
//         });
//     });
// });

// app.listen(4000, () => {
//     console.log('This is for MYSQL');
// });



const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const mysql = require('mysql2'); // Import MySQL library

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json()); // Parse JSON request bodies

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: 'http://10.10.165.93:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'test',
  password: 'test',
  database: 'linux',
  port: '3307',
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection failed:', err);
    process.exit(1); // Exit the process if DB connection fails
  }
  console.log('MySQL Connected...');
});

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('New client connected');

  const sshClient = new Client();

  // When the frontend sends an SSH connect request
  socket.on('ssh-connect', (config) => {
    console.log('SSH connection attempt with config:', config);

    sshClient
      .on('ready', () => {
        console.log('SSH connection established');
        socket.emit('data', '\r\nSSH connection established\r\n');

        // Start an interactive shell session
        sshClient.shell({ term: 'xterm', rows: 24, cols: 80 }, (err, stream) => {
          if (err) {
            console.error('Shell error:', err);
            return socket.emit('data', `Error: ${err.message}`);
          }

          // Forward data from the SSH shell to the frontend
          stream.on('data', (data) => {
            socket.emit('data', data.toString());
          });

          // Notify frontend when the SSH session ends
          stream.on('close', () => {
            console.log('SSH stream closed');
            sshClient.end();
            socket.emit('data', '\r\nConnection closed\r\n');
          });

          // Receive commands from the frontend and write them to the SSH shell
          socket.on('command', (command) => {
            stream.write(command);
          });

          // Handle terminal resize requests
          socket.on('resize', ({ rows, cols }) => {
            stream.setWindow(rows, cols, 600, 800);
          });
        });
      })
      .on('error', (err) => {
        console.error('SSH connection error:', err);
        socket.emit('data', `Connection error: ${err.message}`);
      })
      .connect(config);
  });

  // Clean up when the socket disconnects
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    sshClient.end();
  });
});

// API Endpoint for Login and Fetch Data
app.post('/api/login', (req, res) => {
  const { register_number } = req.body;

  // Fetch student details
  const studentQuery = `SELECT * FROM student_list WHERE register_number = ?`;
  db.query(studentQuery, [register_number], (err, studentResult) => {
    if (err || studentResult.length === 0) return res.status(404).json({ message: 'Student not found' });

    const student = studentResult[0];
    const level = student.level;

    // Fetch IP for the level
    const levelQuery = `SELECT ip FROM level_master WHERE level = ?`;
    db.query(levelQuery, [level], (err, levelResult) => {
      if (err || levelResult.length === 0) return res.status(404).json({ message: 'Level IP not found' });

      const ip = levelResult[0].ip;

      // Fetch system user
      const systemQuery = `SELECT * FROM system_list WHERE level = ? ORDER BY RAND() LIMIT 1`;
      db.query(systemQuery, [level], (err, systemResult) => {
        if (err || systemResult.length === 0) return res.status(404).json({ message: 'System user not found' });

        const systemUser = systemResult[0];

        // Fetch tasks for the system user
        const taskQuery = `SELECT * FROM task_description WHERE username = ?`;
        db.query(taskQuery, [systemUser.username], (err, taskResult) => {
          if (err || taskResult.length === 0) return res.status(404).json({ message: 'Tasks not found' });

          const tasks = taskResult[0];
          res.json({ student, ip, systemUser, tasks });
        });
      });
    });
  });
});

// Start the server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

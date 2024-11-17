const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const mysql = require('mysql2');
const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"], 
    credentials: true
  }
});


io.on('connection', (socket) => {
  const sshClient = new Client();
  let isFirstBuffer = true; // Flag to track the first buffer

  socket.on('ssh-connect', (config) => {
    sshClient
      .on('ready', () => {
        socket.emit('data', 'SSH connection established');
        sshClient.shell((err, stream) => {
          if (err) return socket.emit('data', `Error: ${err.message}`);

          stream
            .on('data', (data) => {
            //   Skip the first buffer
              if (isFirstBuffer) {
                isFirstBuffer = false;
                return;
              }
            
              console.log(data.toString());
            //   isFirstBuffer = true;
              socket.emit('data', data.toString())
            })
            .on('close', () => {
              sshClient.end();
              socket.emit('data', 'Connection closed');
            });

          socket.on('command', (command) => stream.write(command + '\n'));
          
        });
      })
      .on('error', (err) => socket.emit('data', `Connection error: ${err.message}`))
      .connect(config);
  });

  socket.on('disconnect', () => {
    sshClient.end();
  });
});

// server.listen(4000, () => {
//   console.log('This is for SSH');
// });

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'test',
    password: 'test',
    database: 'linux',
    port: '3307',
});

db.connect((err) => {
    if (err) throw err;
    console.log('MySQL Connected...');
});

// Endpoint for Login and Fetch Data
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

app.listen(4000, () => {
    console.log('This is for MYSQL');
});


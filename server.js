// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const { Server } = require('socket.io');
// const { Client } = require('ssh2');
// const mysql = require('mysql2'); // Import MySQL library
// const { exec } = require('child_process'); // Import exec to execute shell commands
// const app = express();
// const server = http.createServer(app);

// // Middleware
// app.use(cors({ origin: 'http://localhost:3000' }));
// app.use(express.json()); // Parse JSON request bodies


// // API Endpoint to Run Bash Script
// app.get('/api/check-tasks', (req, res) => {
//   const scriptPath = '/path/to/your/script.sh'; // Replace with the full path to your script

//   exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
//     if (error) {
//       console.error(`Error executing script: ${error.message}`);
//       return res.status(500).json({ message: 'Error executing script', error: error.message });
//     }
//     if (stderr) {
//       console.error(`Script stderr: ${stderr}`);
//       return res.status(500).json({ message: 'Script error', error: stderr });
//     }

//     // Send the script output to the frontend
//     res.json({ output: stdout });
//   });
// });

// // Configure Socket.IO with CORS
// const io = new Server(server, {
//   cors: {
//     origin: 'http://10.10.165.93:3000',
//     methods: ['GET', 'POST'],
//     allowedHeaders: ['Content-Type'],
//     credentials: true,
//   },
// });


// // MySQL Connection
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'test',
//   password: 'test',
//   database: 'linux',
//   port: '3307',
// });

// db.connect((err) => {
//   if (err) {
//     console.error('MySQL connection failed:', err);
//     process.exit(1); // Exit the process if DB connection fails
//   }
//   console.log('MySQL Connected...');
// });

// // Handle Socket.IO connections
// io.on('connection', (socket) => {
//   console.log('New client connected');

//   const sshClient = new Client();

//   // When the frontend sends an SSH connect request
//   socket.on('ssh-connect', (config) => {
//     console.log('SSH connection attempt with config:', config);

//     sshClient
//       .on('ready', () => {
//         console.log('SSH connection established');
//         socket.emit('data', '\r\nSSH connection established\r\n');

//         // Start an interactive shell session
//         sshClient.shell({ term: 'xterm', rows: 24, cols: 80 }, (err, stream) => {
//           if (err) {
//             console.error('Shell error:', err);
//             return socket.emit('data', `Error: ${err.message}`);
//           }

//           // Forward data from the SSH shell to the frontend
//           stream.on('data', (data) => {
//             socket.emit('data', data.toString());
//           });

//           // Notify frontend when the SSH session ends
//           stream.on('close', () => {
//             console.log('SSH stream closed');
//             sshClient.end();
//             socket.emit('data', '\r\nConnection closed\r\n');
//           });

//           // Receive commands from the frontend and write them to the SSH shell
//           socket.on('command', (command) => {
//             stream.write(command);
//           });

//           // Handle terminal resize requests
//           socket.on('resize', ({ rows, cols }) => {
//             stream.setWindow(rows, cols, 600, 800);
//           });
//         });
//       })
//       .on('error', (err) => {
//         console.error('SSH connection error:', err);
//         socket.emit('data', `Connection error: ${err.message}`);
//       })
//       .connect(config);
//   });

//   // Clean up when the socket disconnects
//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//     sshClient.end();
//   });
// });

// // API Endpoint for Login and Fetch Data
// app.post('/api/login', (req, res) => {
//   const { register_number } = req.body;

//   // Fetch student details
//   const studentQuery = `SELECT * FROM student_list WHERE register_number = ?`;
//   db.query(studentQuery, [register_number], (err, studentResult) => {
//     if (err || studentResult.length === 0) return res.status(404).json({ message: 'Student not found' });

//     const student = studentResult[0];
//     const level = student.level;

//     // Fetch IP for the level
//     const levelQuery = `SELECT ip FROM level_master WHERE level = ?`;
//     db.query(levelQuery, [level], (err, levelResult) => {
//       if (err || levelResult.length === 0) return res.status(404).json({ message: 'Level IP not found' });

//       const ip = levelResult[0].ip;

//       // Fetch system user
//       const systemQuery = `SELECT * FROM system_list WHERE level = ? ORDER BY RAND() LIMIT 1`;
//       db.query(systemQuery, [level], (err, systemResult) => {
//         if (err || systemResult.length === 0) return res.status(404).json({ message: 'System user not found' });

//         const systemUser = systemResult[0];

//         // Fetch tasks for the system user
//         const taskQuery = `SELECT * FROM task_description WHERE username = ?`;
//         db.query(taskQuery, [systemUser.username], (err, taskResult) => {
//           if (err || taskResult.length === 0) return res.status(404).json({ message: 'Tasks not found' });

//           const tasks = taskResult[0];
//           res.json({ student, ip, systemUser, tasks });
//         });
//       });
//     });
//   });
// });

// // Start the server
// const PORT = 4000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
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

// API Endpoint to execute script remotely
app.post('/api/execute-script', (req, res) => {
  const scriptPath = '/home/master/verify.sh'; // Path of the script on the remote Ubuntu machine

  const sshConfig = {
    host: '10.10.237.146', // Remote Ubuntu IP
    port: 22, // Default SSH port
    username: 'master', // Remote username
    password: 'master', // Remote password
  };

  const sshClient = new Client();

  sshClient
    .on('ready', () => {
      console.log('SSH Connection established');

      // Full path to bash in case it's needed
      const command = `/bin/bash ${scriptPath}`;
      console.log('Executing command on remote system:', command);

      // Execute the script on the remote machine
      sshClient.exec(command, (err, stream) => {
        if (err) {
          console.error('SSH Execution error:', err);
          return res.status(500).json({ error: 'Error executing script', details: err });
        }

        let output = '';

        // Capture the output from the script execution
        stream.on('data', (data) => {
          output += data.toString();
        });

        // Capture any errors from stderr
        stream.on('stderr', (data) => {
          console.error('Script stderr:', data.toString());
        });

        // Send the output back to the client when execution is complete
        stream.on('close', (code, signal) => {
          console.log(`Script execution finished with code ${code}`);
          sshClient.end();
          res.json({ output }); // Send the collected output to the frontend
        });
      });
    })
    .on('error', (err) => {
      console.error('SSH Connection error:', err);
      res.status(500).json({ error: 'SSH Connection failed', details: err });
    })
    .connect(sshConfig); // Connect using the provided config
});

// Start the server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

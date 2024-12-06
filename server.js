const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const mysql = require('mysql2'); // Import MySQL library
const { exec } = require('child_process'); // Import exec to execute shell commands
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json()); // Parse JSON request bodies

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
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
        let skipStream = true
        console.log('SSH connection established');
        socket.emit('data', '\r\nSSH connection established\r\n');

        // Start an interactive shell session
        sshClient.shell({ term: 'xterm', rows: 20, cols: 80 }, (err, stream) => {

          if (err) {
            console.error('Shell error:', err);
            return socket.emit('data', `Error: ${err.message}`);
          }

          // Forward data from the SSH shell to the frontend
          stream.on('data', (data) => {
            if(!skipStream){
              socket.emit('data', data.toString());
            }
            skipStream = false
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
      const systemQuery = `SELECT * FROM system_list WHERE level = ? AND status=0 ORDER BY RAND() LIMIT 1 `;
      db.query(systemQuery, [level], (err, systemResult) => {
        if (err || systemResult.length === 0) return res.status(404).json({ message: 'System user not found' });

        const systemUser = systemResult[0];

      const statusQuery = `UPDATE system_list SET status = 1 WHERE id=${systemUser.id}`;
      db.query(statusQuery)


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

app.post('/api/execute-script', (req, res) => {
  const { ip, username, password, scriptPath } = req.body; // Get details from frontend

  if (!ip || !username || !password || !scriptPath) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const sshClient = new Client();

  sshClient
    .on('ready', () => {
      console.log(`SSH connection established with ${ip}`);

      const command = `/bin/bash ${scriptPath}`; // Command to execute script
      console.log('Executing command:', command);

      sshClient.exec(command, (err, stream) => {
        if (err) {
          console.error('SSH Execution error:', err);
          return res.status(500).json({ error: 'Error executing script', details: err.message });
        }

        let output = '';

        // Capture standard output
        stream.on('data', (data) => {
          output += data.toString();
        });

        // Capture standard error
        stream.on('stderr', (data) => {
          console.error('Script stderr:', data.toString());
        });

        // Send the output to the client when the command finishes
        stream.on('close', (code, signal) => {
          console.log(`Script finished with code ${code}, signal ${signal}`);
          sshClient.end();
          res.json({ output }); // Send output back to frontend
        });
      });
    })
    .on('error', (err) => {
      console.error('SSH Connection error:', err);
      res.status(500).json({ error: 'SSH connection failed', details: err.message });
    })
    .connect({
      host: ip,
      port: 22,
      username,
      password,
    });
  });

  app.post('/api/logout', (req, res) => {
    const { level_user_id, complete, reg_no } = req.body; // Ensure `reg_no` is sent in the request body
    console.log('Logging out user:', level_user_id);
  
    if (complete === 0) {
      const resetStatus = `UPDATE system_list SET status = 0 WHERE id = ?`;
      db.query(resetStatus, [level_user_id], (err) => {
        if (err) {
          console.error('Error resetting status:', err);
          return res.status(500).json({ message: 'Failed to reset status' });
        }
      });
    } else if (complete === 1) {
      const resetStatus = `UPDATE system_list SET status = 0 WHERE id = ?`;
      const updateLevel = `UPDATE student_list SET level = level + 1 WHERE register_number = ?`;
  
      // Execute queries sequentially
      db.query(resetStatus, [level_user_id], (err) => {
        if (err) {
          console.error('Error resetting status:', err);
          return res.status(500).json({ message: 'Failed to reset status' });
        }
        db.query(updateLevel, [reg_no], (err) => {
          if (err) {
            console.error('Error updating level:', err);
            return res.status(500).json({ message: 'Failed to update level' });
          }
        });
      });
    }
  
    // Send success response
    res.json({ message: 'Logout successful' });
    console.log('Logout successful');
  });
  

// Start the server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
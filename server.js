const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const mysql = require('mysql2'); // Import MySQL library
const { exec } = require('child_process'); // Import exec to execute shell commands
const { SELECT } = require('sequelize/lib/query-types');
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON request bodies

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});


// MySQL Connection
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: 'tes0CQ)[iVE-Bg{x@v)w&Ev.OV$}t',
//   database: 'linux',
//   port: '3306',
// });
const db = mysql.createConnection({
  host: '10.10.111.2',
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
            if (!skipStream) {
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

// app.post('/api/dashboard/main'),(res) =>{
//   const Total_students = `SELECT COUNT(*) FROM summary where date = CURDATE()`;
//   const Cleared_today = `SELECT COUNT(*) FROM summary where date = CURDATE() and final_result = 1`;
//   const Benchmark = `SELECT COUNT(*) FROM summary where date = CURDATE() and final_result = 1 and task_completed = 1`;
//   const Failed_today = `SELECT COUNT(*) FROM summary where date = CURDATE() and final_result = 0`;
//   db.query(Total_students, (err, Total_students) => {
//     if (err) {
//       console.error('Error fetching Total_students:', err);
//       return res.status(500).json({ message: 'Error fetching Total_students' });
//     }
//   });
//   db.query(Cleared_today, (err, Cleared_today) => {
//     if (err) {
//       console.error('Error fetching Cleared_today:', err);
//       return res.status(500).json({ message: 'Error fetching Cleared_today' });
//     }
//   });
//   db.query(Benchmark, (err, Benchmark) => {
//     if (err) {
//       console.error('Error fetching Benchmark:', err);
//       return res.status(500).json({ message: 'Error fetching Benchmark' });
//     }
//   });
//   db.query(Failed_today, (err, Failed_today) => {
//     if (err) {
//       console.error('Error fetching Failed_today:', err);
//       return res.status(500).json({ message: 'Error fetching Failed_today' });
//     }
//   });
//   res.json({ Total_students, Cleared_today, Benchmark, Failed_today });
//   console.log('Dashboard data fetched');
// }

app.get('/api/dashboard/main', (req, res) => {
    const Total_students = `SELECT COUNT(*) AS Total_students FROM summary WHERE date = CURDATE()`;
    const Cleared_today = `SELECT COUNT(*) AS Cleared_today FROM summary WHERE date = CURDATE() AND final_result = 1`;
    const Benchmark = `SELECT COUNT(*) AS Benchmark FROM summary WHERE date = CURDATE() AND final_result = 1 AND task_completed = 1`;
    const Failed_today = `SELECT COUNT(*) AS Failed_today FROM summary WHERE date = CURDATE() AND final_result = 0`;

    // Execute all queries and collect results
    const queries = [
        { query: Total_students, key: 'Total_students' },
        { query: Cleared_today, key: 'Cleared_today' },
        { query: Benchmark, key: 'Benchmark' },
        { query: Failed_today, key: 'Failed_today' },
    ];

    const results = {};
    let completed = 0;

    queries.forEach(({ query, key }) => {
        db.query(query, (err, result) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err);
                return res.status(500).json({ message: `Error fetching ${key}` });
            }

            // Store the result in the results object
            results[key] = result[0][key];
            completed++;

            // If all queries are completed, send the response
            if (completed === queries.length) {
                res.json(results);
                console.log('Dashboard data fetched:', results);
            }
        });
    });
});


app.get('/api/students', (req, res) => {
  const query = `SELECT id, name, level, register_number, mail_id,block FROM student_list`;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching student details:', err);
      console.log('error');
      return res.status(500).json({ message: 'Error fetching student details' });
    }
    res.json(results);
    console.log('List fetched');
  });
});

app.get('/api/result', (req, res) => {
  const query = `SELECT * FROM summary`;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching student details:', err);
      console.log('error');
      return res.status(500).json({ message: 'Error fetching student details' });
    }
    res.json(results);
    console.log('List fetched');
  });
});



app.post('/api/dashboard/list', (req, res) => {
  const list = `SELECT * FROM summary:`;
  db.query(list, (err, list) => {
    if (err) {
      console.error('Error fetching list:', err);
      return res.status(500).json({ message: 'Error fetching list' });
    }
    res.json({ list });
    // console.log('List fetched');
  });
  res.json({list});
});

app.post('/api/logout', (req, res) => {
  const { level_user_id, complete, reg_no } = req.body; // Ensure `reg_no` is sent in the request body
  console.log('Logging out user:', level_user_id);
  const task_completed = complete === 1 ? 1 : 0;
  const summary = `insert into summary (date,time,register_number,name,mail_id,task_completed,final_result) values (NOW(),NOW(), ?, (SELECT name FROM student_list WHERE register_number = ?), (SELECT mail_id FROM student_list WHERE register_number = ?), ?, ?)`;
  db.query(summary, [reg_no,reg_no,reg_no, complete, complete], (err) => {
    if (err) {
      console.error('Error in Manufacturing the student summary', err);
      return res.status(500).json({ message: 'Error in Manufacturing the student summary' });
    }
  });

  // Reset the status of the system user
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

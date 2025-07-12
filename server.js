// socket.on('joinRoom', (roomName, playerData) => {
//     socket.join(roomName);

//     if (!rooms[roomName]) {
//         rooms[roomName] = {
//             players: [],
//             hosts: [],
//             quizQuestions: [],
//             currentQuestionIndex: 0,
//             quizStarted: false,
//             votes: [],
//             currentQuestionTime: 15,
//             timerInterval: null,
//             timerPerQuestion: 15,
//             votingAllowed: false,
//             isAvailable: true,
//             pdfPath: path.join(__dirname, 'uploads', 'slides.pdf'),
//             currentPage: 1,
//             chatMessages: [] // Store chat messages for the room
//         };
//     }

//     // Check if the email is in the validEmails array
//     if (validEmails.includes(playerData.email)) {
//         rooms[roomName].hosts.push(socket.id);
//         io.to(socket.id).emit('hostAssigned'); // Notify the host
//     }

//     // Add the player to the room
//     rooms[roomName].players.push({ id: socket.id, name: playerData.name, picture: playerData.picture, email: playerData.email });

//     // If the quiz has already started, send the current question
//     if (rooms[roomName].quizStarted) {
//         const currentQuestion = rooms[roomName].quizQuestions[rooms[roomName].currentQuestionIndex];
//         io.to(socket.id).emit('quizStarted', currentQuestion);
//     }

//     // Notify all players about the updated player list
//     io.to(roomName).emit('updatePlayers', rooms[roomName].players);

//     // If there's an existing PDF, notify the user
//     if (rooms[roomName].pdfPath) {
//         io.to(socket.id).emit('pdfUploaded', `/uploads/slides.pdf`);
//         io.to(socket.id).emit('pageChanged', rooms[roomName].currentPage);
//     }
// });







const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['my-custom-header'],
        credentials: true
    }
});

app.use(cors());
app.use(express.static('host'));
app.use(express.static('slides'));
app.use(express.static('viewer'));
app.use('/uploads', express.static('uploads'));

app.use(express.static(path.join(__dirname, '../host'))); 
app.use(express.static(path.join(__dirname,'../viewer')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 


const uploadFolder = path.join(__dirname, 'uploads'); 

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
}

const clearUploadsFolder = () => {
    return new Promise((resolve, reject) => {
        fs.readdir(uploadFolder, (err, files) => {
            if (err) {
                console.error("Error reading upload folder:", err);
                reject(err);
                return;
            }
            let deletePromises = files.map(file =>
                fs.promises.unlink(path.join(uploadFolder, file))
            );
            Promise.all(deletePromises)
                .then(() => resolve())
                .catch(err => reject(err));
        });
    });
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        cb(null, "slides.pdf");
    }
});

const upload = multer({ storage });

app.post("/upload", async (req, res) => {
    try {
        await clearUploadsFolder();
        upload.single("pdf")(req, res, (err) => {
            if (err) {
                return res.status(500).json({ message: "File upload error", error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }
            res.json({ message: "File uploaded successfully as slides.pdf" });
        });
    } catch (error) {
        res.status(500).json({ message: "Error clearing folder", error: error.message });
    }
});

let rooms = {};

const validEmails = ['himanshu.codeup@gmail.com', 'joshiojas185@gmail.com'];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

   socket.on('joinRoom', (roomName, playerData) => {
    socket.join(roomName);

    if (!rooms[roomName]) {
        rooms[roomName] = {
            players: [],
            hosts: [],
            quizQuestions: [],
            currentQuestionIndex: 0,
            quizStarted: false,
            votes: [],
            currentQuestionTime: 15,
            timerInterval: null,
            timerPerQuestion: 15,
            votingAllowed: false,
            isAvailable: true,
            pdfPath: path.join(__dirname, 'uploads', 'slides.pdf'),
            currentPage: 1,
            chatMessages: [] // Store chat messages for the room
        };
    }

    // Check if the email is in the validEmails array
    if (validEmails.includes(playerData.email)) {
        rooms[roomName].hosts.push(socket.id);
        io.to(socket.id).emit('hostAssigned'); // Notify the host
    }

    // Add the player to the room
    rooms[roomName].players.push({ id: socket.id, name: playerData.name, picture: playerData.picture, email: playerData.email });

    // If the quiz has already started, send the current question
    if (rooms[roomName].quizStarted) {
        const currentQuestion = rooms[roomName].quizQuestions[rooms[roomName].currentQuestionIndex];
        io.to(socket.id).emit('quizStarted', currentQuestion);
    }

    // Notify all players about the updated player list
    io.to(roomName).emit('updatePlayers', rooms[roomName].players);

    // If there's an existing PDF, notify the user
    if (rooms[roomName].pdfPath) {
        io.to(socket.id).emit('pdfUploaded', `/uploads/slides.pdf`);
        io.to(socket.id).emit('pageChanged', rooms[roomName].currentPage);
    }
});
    // Lock the quiz
    socket.on('lockQuiz', (roomName) => {
        rooms[roomName].isAvailable = false;
        io.to(roomName).emit('quizLocked', { message: "Thank you for joining the quiz! You will be redirected shortly.", image: 'thank-you.png' });
    });

    // Upload Quiz
    socket.on('uploadQuiz', (roomName, quizJson, timerPerQuestion) => {
        if (rooms[roomName].hosts.includes(socket.id)) {
            try {
                const quizData = JSON.parse(quizJson);
                rooms[roomName].quizQuestions = quizData.questions;
                rooms[roomName].votes = rooms[roomName].quizQuestions.map(question => Array(question.options.length).fill(0));
                rooms[roomName].timerPerQuestion = timerPerQuestion;
                io.to(roomName).emit('quizUploaded', rooms[roomName].quizQuestions.length);
            } catch (err) {
                console.error('Invalid JSON format:', err);
                io.to(roomName).emit('uploadError', 'Invalid JSON format. Please check your file.');
            }
        } else {
            io.to(socket.id).emit('uploadError', 'You are not authorized to upload a quiz.');
        }
    });

    // Start Quiz
    socket.on('startQuiz', (roomName) => {
        if (rooms[roomName].hosts.includes(socket.id) && rooms[roomName].quizQuestions.length > 0) {
            rooms[roomName].quizStarted = true;
            rooms[roomName].currentQuestionIndex = 0;
            io.to(roomName).emit('quizStarted', rooms[roomName].quizQuestions[rooms[roomName].currentQuestionIndex]);
            startTimer(roomName, rooms[roomName].timerPerQuestion);
        } else {
            io.to(socket.id).emit('startError', 'You are not authorized to start the quiz or there are no questions.');
        }
    });

    function startTimer(roomName, duration) {
        let timeLeft = duration;
        rooms[roomName].votingAllowed = true;
        rooms[roomName].timerInterval = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(rooms[roomName].timerInterval);
                rooms[roomName].votingAllowed = false;
                io.to(roomName).emit('showPoll', rooms[roomName].votes[rooms[roomName].currentQuestionIndex]);
                io.to(roomName).emit('timerEnded');
            } else {
                io.to(roomName).emit('updateTimer', timeLeft);
                timeLeft--;
            }
        }, 1000);
    }

    // Handle Voting
    socket.on('vote', (roomName, option) => {
        const currentQuestionIndex = rooms[roomName].currentQuestionIndex;
        const optionIndex = option.charCodeAt(0) - 65; // Convert 'A', 'B', 'C', etc. to index
        if (rooms[roomName].quizStarted && rooms[roomName].votingAllowed && rooms[roomName].votes[currentQuestionIndex][optionIndex] !== undefined) {
            rooms[roomName].votes[currentQuestionIndex][optionIndex]++;
            io.to(roomName).emit('updateVotes', rooms[roomName].votes[currentQuestionIndex]);
        }
    });

    // Handle Next Question
    socket.on('nextQuestion', (roomName) => {
        if (rooms[roomName].hosts.includes(socket.id) && rooms[roomName].currentQuestionIndex < rooms[roomName].quizQuestions.length - 1) {
            rooms[roomName].currentQuestionIndex++;
            clearInterval(rooms[roomName].timerInterval); 
            io.to(roomName).emit('nextQuestion', rooms[roomName].quizQuestions[rooms[roomName].currentQuestionIndex]);
            startTimer(roomName, rooms[roomName].timerPerQuestion);
        } else if (rooms[roomName].currentQuestionIndex === rooms[roomName].quizQuestions.length - 1) {
            io.to(roomName).emit('quizEnded');
        }
    });

    // Handle Page Navigation for PDF
    socket.on('nextPage', (roomName) => {
        if (rooms[roomName].pdfPath) {
            rooms[roomName].currentPage++;
            io.to(roomName).emit('pageChanged', rooms[roomName].currentPage);
        }
    });

    socket.on('prevPage', (roomName) => {
        if (rooms[roomName].currentPage > 1) {
            rooms[roomName].currentPage--;
            io.to(roomName).emit('pageChanged', rooms[roomName].currentPage);
        }
    });

    socket.on('goToPage', (roomName, pageNumber) => {
        if (rooms[roomName] && rooms[roomName].pdfPath) {
            rooms[roomName].currentPage = pageNumber;
            io.to(roomName).emit('pageChanged', rooms[roomName].currentPage);
        }
    });

    // Chat message Event
    socket.on('chat message', (roomName, msg) => {
        console.log('Message received from ' + socket.id + ' in room ' + roomName + ': ' + msg);
        
        // Add message to the room's chat history
        rooms[roomName].chatMessages.push({ id: socket.id, message: msg });

        // Emit the chat message to the room
        io.to(roomName).emit('chat message', { name: socket.id, message: msg });
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
        for (const roomName in rooms) {
            const playerIndex = rooms[roomName].players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = rooms[roomName].players[playerIndex].name; // Get the player's name

                rooms[roomName].players.splice(playerIndex, 1);
                io.to(roomName).emit('updatePlayers', rooms[roomName].players);
            }
        }
        console.log('A user disconnected:', socket.id);
    });
});


const PORT = process.env.PORT || 5000;

const HOST = 'localhost';

server.listen(PORT, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
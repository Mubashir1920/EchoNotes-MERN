require("dotenv").config();
const config = require('./config.json')
const mongoose = require('mongoose');

mongoose.connect(process.env.connectionString)
    .then(()=>console.log("Mongo Connected "));


const User = require('./models/user.model')
const Note = require('./models/note.model')

const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json())
app.use(
    cors({
        origin: '*'
    })
);

const jwt = require('jsonwebtoken')
const { authenticatetoken } = require('./utilities')

app.get('/', function (req, res) {
    res.json({ data: "Helll Word" })
});

// Create User

app.post('/create-account', async (req, res) => {

    const { fullname, email, password } = req.body;

    if (!fullname) {
        return res
            .status(400)
            .json({ error: true, message: "Full Name is Required!" })
    }


    if (!email) {
        return res
            .status(400)
            .json({ error: true, message: "Email is Required!" })
    }
    if (!password) {
        return res
            .status(400)
            .json({ error: true, message: "Password is Required!" })
    }

    const isUser = await User.findOne({
        email: email
    })
    if (isUser) {
        return res
            .status(400)
            .json({ error: true, message: "Email is already taken!" })
    }

    const newuser = new User({
        fullname,
        email,
        password
    });

    await newuser.save();

    return res.json({
        error: false,
        message: "Account Created Successfully!",
        newuser
    })

})


// Login 

app.post('/login', async (req, res) => {

    const { email, password } = req.body;
    if (!email) {
        return res
            .status(400)
            .json({ error: true, message: "Email is Required!" })
    }
    if (!password) {
        return res
            .status(400)
            .json({ error: true, message: "Password is Required!" })
    }
    const user = await User.findOne({ email: email });
    if (!user) {
        return res
            .status(400)
            .json({ error: true, message: "Email is not Registered!" })
    }
    if (user.password !== password) {
        return res
            .status(400)
            .json({ error: true, message: "Password is Incorrect!" })
    }
    const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '200h'
    })
    return res.json({
        error: false,
        message: "Login Successfully!",
        accessToken,
        user
    })



})


// Get User

app.get('/get-user', authenticatetoken, async (req, res) => {

    const { user } = req.user;
    const isUser = await User.findOne({ _id: user._id })
    if (!isUser) {
        res.sendStatus(401)
    }
    return res.json({
        user: {
            fullname: isUser.fullname,
            email: isUser.email,
            createdOn: isUser.createdOn,
            id: isUser._id
        },
        message: ""
    })
})



// add Note
app.post('/add-note', authenticatetoken, async (req, res) => {

    const { title, content, tags } = req.body;
    const { user } = req.user;

    if (!title) {
        return res.status(400).json({ error: true, message: "Title is Required!" })
    }
    if (!content) {
        return res.status(400).json({ error: true, message: "Content is Required!" })
    }

    
    try {
        const note = new Note({
            title,
            content,
            tags: tags || [],
            userId: user._id
        });

        await note.save();

        return res.json({
            error: false,
            note,
            user,
            message: "Note Added Successfully!"
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            error: true, message: "Something Went Terribly Wrong!"
        })
    }

})

// Edit Note

app.put('/edit-note/:noteId', authenticatetoken, async (req, res) => {


    const noteId = req.params.noteId;
    const { title, content, tags, isPinned } = req.body;
    const { user } = req.user;


    if (!title && !content && !tags) {
        res.
            status(400)
            .json({
                error: true,
                message: "No Changes Provided"
            })
    }


    const note = await Note.findOne({ _id: noteId, userId: user._id })

    if (!note) {
        return res.status(400).json({
            error: true, message: "Note Not Found!"
        })
    }
    try {
        if (title) note.title = title;
        if (content) note.content = content;
        if (tags) note.tags = tags;
        if (isPinned) note.isPinned = isPinned;
        await note.save();
        return res.json({
            error: false,
            note,
            user,
            message: "Note Updated Successfully!"
        })
    } catch (error) {
        return res.status(500).json({
            error: true, message: "Something Went Wrong!"
        })
    }

})


// Get All notes
app.get('/get-all-note', authenticatetoken, async (req, res) => {

    const { user } = req.user;
    try {
        const notes = await Note.find({ userId: user._id }).sort({
            isPinned: -1
        });
        return res.json({
            error: false,
            notes,
            user,
            message: "Notes Fetched Successfully!"
        })
    } catch (error) {
        return res.status(500).json({
            error: true, message: "Something Went Wrong!"
        })
    }



})

// Delete A Note
app.delete('/delete-note/:noteId', authenticatetoken, async (req, res) => {

    const { user } = req.user
    const noteId = req.params.noteId;
    try {
        const note = await Note.findOneAndDelete({
            _id: noteId, userId: user._id
        });
        if (!note) return res.status(404).json({
            error: true, message: "Note Not Found!"
        })
        return res.json({
            error: false,
            message: "Note Deleted Successfully!"
        })
    } catch (error) {
        return res.status(500).json({
            error: true, message: "Something Went Wrong!"
        })
    }
})


// update Pinned Note
app.put('/update-pinned-note/:noteId', authenticatetoken, async (req, res) => {

    const noteId = req.params.noteId;
    const { isPinned } = req.body;
    const { user } = req.user;



    const note = await Note.findOne({ _id: noteId, userId: user._id })

    if (!note) {
        return res.status(400).json({
            error: true, message: "Note Not Found!"
        })
    }
    try {

        note.isPinned = isPinned;
        await note.save();
        return res.json({
            error: false,
            note,
            user,
            message: "Note Pinned Successfully!"
        })
    } catch (error) {
        return res.status(500).json({
            error: true, message: "Something Went Wrong!"
        })
    }




})

// Search Notes
app.get("/search-notes", authenticatetoken, async (req, res) => {
    const { user } = req.user;
    const  {query}  = req.query;

    if (!query) {
        return res
            .status(400)
            .json({ error: true, message: "Search query is required" });
    }

    try {
        const matchingNotes = await Note.find({
            userId: user._id,
            $or: [
                { title: { $regex: new RegExp(query, "i") } },
                { content: { $regex: new RegExp(query, "i") } },
            ],
        });

        return res.json({
            error: false,
            notes: matchingNotes,
            message: "Notes matching the search query retrieved successfully",
        });
    } catch (error) {
        return res.status(500).json({
            error: true,
            message: "An error occurred while searching for notes",
        });
    }
});



app.listen(9000, () => {
    console.log('Server Started AT Port 9000')
})


module.exports = app

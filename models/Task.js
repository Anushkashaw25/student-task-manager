
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 3
    },

    subject: {
        type: String,
        required: true,
        trim: true
    },

    deadline: {
        type: String,
        required: true
    },

    priority: {
        type: String,
        required: true,
        enum: ["Low", "Medium", "High"]
    },

    completed: {
        type: Boolean,
        default: false
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }

});

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;

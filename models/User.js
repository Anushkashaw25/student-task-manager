const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true,
        minlength: 6
    },

    sessionVersion: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
module.exports = User;
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const helmet = require("helmet");

const User = require("./models/User");
const Task = require("./models/Task");
const { csrfSync } = require("csrf-sync");

const app = express();
const port = process.env.PORT || 8080;

// -------------------- MIDDLEWARE --------------------

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "sessions"
    }),

    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    }
}));
const {
    generateToken,
    csrfSynchronisedProtection
} = csrfSync({
    getTokenFromRequest: (req) => {
        return req.body?._csrf;
    }
});
app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    next();
});
app.use(csrfSynchronisedProtection);

// -------------------- LOGIN PROTECTION --------------------

async function requireLogin(req, res, next) {
    try {
        //Check whether the user is logged in
        if (!req.session.userId) {
            return res.redirect("/login");
        }

        //Find the user in MongoDB
        const user = await User.findById(req.session.userId);

        //If the user no longer exists, destroy the session
        if (!user) {
            return req.session.destroy((err) => {
                if (err) return next(err);

                res.clearCookie("connect.sid");
                return res.redirect("/login");
            });
        }

        //Compare the session version with the user's current version
        const sessionVersion = req.session.sessionVersion ?? -1;
        const userVersion = user.sessionVersion ?? 0;

        if (sessionVersion !== userVersion) {
            return req.session.destroy((err) => {
                if (err) return next(err);

                res.clearCookie("connect.sid");
                return res.redirect("/login");
            });
        }

        //Allow access if everything is valid
        next();

    } catch (err) {
        next(err);
    }
}
// Validate MongoDB task IDs
app.param("id", (req, res, next, id) => {
    if (!mongoose.isValidObjectId(id)) {
        return res.redirect("/?error=Invalid%20task%20ID");
    }

    next();
});

// -------------------- REGISTER --------------------

app.get("/register", (req, res) => {
    res.render("register", { error: "" });
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).render("register", {
                error: "All fields are required!"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(400).render("register", {
                error: "Email already registered!"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword
        });

        await newUser.save();

        res.redirect("/login");

    } catch (err) {
        console.error(err);

        if (err.code === 11000) {
            return res.status(400).render("register", {
                error: "Email already registered!"
            });
        }

        res.status(500).render("register", {
            error: "Registration failed! Please try again."
        });
    }
});

// -------------------- LOGIN --------------------
app.get("/login", (req, res) => {
    if (req.session.userId) {
        return res.redirect("/");
    }

    res.render("login", {
        error: ""
    });
});
app.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("login", {
                error: "Email and password are required!"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(401).render("login", {
                error: "Invalid email or password!"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).render("login", {
                error: "Invalid email or password!"
            });
        }

        // Regenerate session after successful login
        req.session.regenerate((err) => {
            if (err) return next(err);

            req.session.userId = user._id;
            req.session.sessionVersion = user.sessionVersion ?? 0;

            req.session.save((err) => {
                if (err) return next(err);

                res.redirect("/");
            });
        });

    } catch (err) {
        next(err);
    }
});

// -------------------- LOGOUT --------------------

app.post("/logout", requireLogin, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            return next(err);
        }

        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

//--------------------PROFILE--------------------
app.get("/profile",  requireLogin, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.userId);
        if(!currentUser) {
            return res.redirect("/login");
        }
        res.render("profile", {
            currentUser,
            error: "",
            success: ""
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Unable to load profile.");
    }
});

//--------------------UPDATE PROFILE NAME---------------
app.post("/profile", requireLogin, async (req, res) => {
    try {
        const name = (req.body.name || "").trim();
        if(name.length < 2) {
            const currentUser = await User.findById(req.session.userId);
            return res.status(400).render("profile", {
                currentUser,
                error: "name must be at least 2 characters.",
                success: ""
            });
        }
        const currentUser = await User.findByIdAndUpdate(
            req.session.userId,
            { name },
            {
                returnDocument: "after",
                runValidators: true
            }
        );
        if(!currentUser) {
            return res.redirect("/login");
        }
    res.render("profile", {
        currentUser,
        error: "",
        success: "Profile updated successfully."    
    });
} catch (err) {
    console.error(err);
    res.status(500).send("Unable to update profile.");
     }
});

//--------------------CHANGE PASSWORD--------------------
app.post("/profile/change-password", requireLogin, async (req, res, next) => {
    try {
        const {
            currentPassword,
            newPassword,
            confirmPassword  
        } = req.body;
        //find the current Logged-in user
        const currentUser = await User.findById(req.session.userId);
        if (!currentUser) {
            return res.redirect("/login");
        }
        //2. check whether all fields are filled
        if(!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).render("profile", {
                currentUser,
                error: "All fields are required.",
                success: ""
            });
        }
        //check whether the current password is correct
        const isPasswordCorrect = await bcrypt.compare(
            currentPassword,
            currentUser.password
        );
        if (!isPasswordCorrect) {
            return res.status(400).render("profile", {
                currentUser,
                error: "Current password is incorrect.",
                success: ""
            });
        }
        //check new password length
        if (newPassword.length < 6) {
            return res.status(400).render("profile", {
                currentUser,
                error: "New password must be at least 6 characters.",
                success: ""
            });
        }
        //check whether new password and confirm password match
        if (newPassword !== confirmPassword) {
            return res.status(400).render("profile", {
                currentUser,
                error: "New password and confirm password do not match.",
                success: ""
            });
        }
       const hashedPassword = await bcrypt.hash(newPassword, 12);

// Update the password
currentUser.password = hashedPassword;

// Increase the session version
currentUser.sessionVersion = (currentUser.sessionVersion ?? 0) + 1;

// Save both changes in MongoDB
await currentUser.save();

// Destroy the current session too
req.session.destroy((err) => {
    if (err) {
        return next(err);
    }

    res.clearCookie("connect.sid");
    return res.redirect("/login");
});
    } catch (err) {
        console.error(err);
        res.status(500).send("Unable to change password.");
        }
    });

// -------------------- DASHBOARD --------------------

app.get("/", requireLogin, async (req, res, next) => {
    try {
        const search = req.query.search;
        const priority = req.query.priority;
        const sort = req.query.sort;
        const status = req.query.status;
        const error = req.query.error;

        let query = {
            user: req.session.userId
        };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { subject: { $regex: search, $options: "i" } }
            ];
        }

        if (priority) {
            query.priority = priority;
        }

        if (status === "completed") {
            query.completed = true;
        }

        if (status === "incomplete") {
            query.completed = false;
        }

        let sortOption = { deadline: 1 };

        if (sort === "latest") {
            sortOption = { deadline: -1 };
        }

        const tasks = await Task.find(query).sort(sortOption);
        const allTasks = await Task.find({
            user: req.session.userId
        });
        const currentUser =  await User.findById(req.session.userId);

        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(
            task => task.completed
         ).length;
        const incompleteTasks = totalTasks - completedTasks;
        const highPriorityTasks = allTasks.filter(
            task => task.priority === "High"
        ).length;
        const completionPercentage = totalTasks === 0
            ? 0
            : Math.round((completedTasks / totalTasks) * 100);

        const today = new Date().toISOString().split("T")[0];
        const overdueTasks = allTasks.filter(
            task => !task.completed && task.deadline < today
        ).length;

        res.render("index", {
            tasks,
            currentUser,
            search: search || "",
            priority: priority || "",
            status: status || "",
            sort: sort || "",
            totalTasks,
            completedTasks,
            incompleteTasks,
            highPriorityTasks,
            completionPercentage,
            today,
            overdueTasks,
            error: error || ""
        });
    } catch (err) {
        next(err);
    }
});

app.post("/tasks", requireLogin, async (req, res) => {
    try {
        const { title, subject, deadline, priority } = req.body;

        await Task.create({
            title,
            subject,
            deadline,
            priority,
            user: req.session.userId
        });

        res.redirect("/");

    } catch (err) {
        console.error(err);
        res.redirect("/?error=Invalid%20task%20data");
    }
});

app.post("/tasks/:id/delete", requireLogin, async (req, res) => {
    try {
        const deletedTask = await Task.findOneAndDelete({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!deletedTask) {
            return res.redirect("/?error=Task%20not%20found");
        }

        res.redirect("/");

    } catch (err) {
        console.error(err);
        res.redirect("/?error=Unable%20to%20delete%20task");
    }
});

app.post("/task/:id/complete", requireLogin, async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!task) {
            return res.redirect("/?error=Task%20not%20found");
        }

        task.completed = !task.completed;
        await task.save();
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.redirect("/?error=Unable%20to%20update%20task");
    }
});

app.get("/task/:id/edit", requireLogin, async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!task) {
            return res.redirect("/?error=Task%20not%20found");
        }

        res.render("edit", {
            task,
            error: ""
        });

    } catch (err) {
        console.error(err);
        res.redirect("/?error=Unable%20to%20open%20task");
    }
});

app.post("/task/:id/edit", requireLogin, async (req, res) => {
    try {
        const { title, subject, deadline, priority } = req.body;

        const updatedTask = await Task.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.session.userId
            },
            {
                title,
                subject,
                deadline,
                priority
            },
            {
                runValidators: true,
                returnDocument: "after"
            }
        );

        if (!updatedTask) {
            return res.redirect("/?error=Task%20not%20found");
        }

        res.redirect("/");

    } catch (err) {
        console.error(err);

        let message = "Something went wrong.";

        if (err.name === "ValidationError") {
            message = Object.values(err.errors)
                .map(error => error.message)
                .join(", ");
        }

        const task = {
            _id: req.params.id,
            title: req.body.title,
            subject: req.body.subject,
            deadline: req.body.deadline,
            priority: req.body.priority
        };

        res.status(400).render("edit", {
            task,
            error: message
        });
    }
});

// -------------------- ERROR HANDLER --------------------

app.use((err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.status || 500;

    res.status(statusCode).send(
        statusCode === 404
            ? "Resource not found!"
            : "Something went wrong! Please try again later."
    );
});

// -------------------- START SERVER --------------------

async function startServer() {
    try {
        console.log(`Environment: ${process.env.NODE_ENV}`);

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });

    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1);
    }
}

startServer();

const helmet = require("helmet");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Task = require("./models/Task");
const app = express();
app.use(helmet());
const port = process.env.PORT || 8080;

async function startServer() {
    try {
        console.log(`Environment: ${process.env.NODE_ENV}`);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
    catch (err) {
        console.log("Failed to connect to MongoDB", err);
        process.exit(1); // Exit the process with an error code
    }
}

startServer();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.param("id",(req, res, next, id) => {
    if(!mongoose.isValidObjectId(id)) {
        return res.redirect("/?error=Invalid%20task%20ID");
    }
    next();
})

app.get("/", async (req, res) => {
   const search = req.query.search;
   const priority = req.query.priority;
   const sort = req.query.sort;
   const status = req.query.status;
   const error = req.query.error;

   let query = {};

   if(search) {
    query.$or = [
        { title: { $regex: search, $options: "i"} },
        {  subject: { $regex: search, $options: "i"} }
    ];
}

if(priority) {
    query.priority = priority;
 }
 if(status === "completed") {
    query.completed = true;
 }
 if(status === "incomplete") {
    query.completed = false;
 }

 let sortOption = { deadline: 1 };

 if(sort === "latest") {
    sortOption = { deadline: -1 };
 }
    
const tasks = await Task.find(query).sort(sortOption);

// Fetch every task for dashboard statistics
const allTasks = await Task.find();

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
});

app.post("/tasks", async (req, res) => {
    try {
        const task = req.body;

        await Task.create(task);
        res.redirect("/");
    }
    catch (err) {
        console.log(err);
       res.redirect("/?error=Invalid%20task%20data");
    }
});

app.post("/tasks/:id/delete", async (req, res) => {
    try {
        const id = req.params.id;

        const deletedTask = await Task.findByIdAndDelete(id);

        if (!deletedTask) {
            return res.redirect("/?error=Task%20not%20found");
        }

        res.redirect("/");
    }
    catch (err) {
        console.log(err);
        res.redirect("/?error=Unable%20to%20delete%20task");
    }
});

app.post("/task/:id/complete", async (req, res) => {
    try {
        const id = req.params.id;
        const task = await Task.findById(id);

        if(!task) {
            return res.redirect("/?error=Task%20not%20found");
        }

        task.completed = !task.completed;
        await task.save();
        res.redirect("/");
    }
    catch (err) {
        console.log(err);
        res.redirect("/?error=Unable%20to%20update%20task");
    }
});

app.get("/task/:id/edit", async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.redirect("/?error=Task%20not%20found");
        }

        res.render("edit", { task , error: ""});
    }
    catch (err) {
        console.log(err);
        res.redirect("/?error=Unable%20to%20open%20task");
    }
});

app.post("/task/:id/edit" , async (req, res) => {
   try {
        const id = req.params.id;
        const updatedTask = await Task.findByIdAndUpdate(
            id, req.body,
            {
                runValidators: true,
                returnDocument: "after"

            }
        );
        
        if(!updatedTask) {
            return res.redirect("/?error=Task%20not%20found");
        }

        res.redirect("/");
   }
   catch (err) {
       console.log(err);

       let message = "something went wrong.";

       if(err.name === "ValidationError") {
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

// app.get("/test-error", (req, res, next) => {
//     next(new Error("Something failed"));
// });

// app.get("/test-404", (req, res, next) => {
//     next({ status: 404, message: "Task not found" });
// });

app.use((err,req, res, next) => {
    console.error(err.stack);

    const statusCode = err.status || 500;
    res.status(statusCode).send(
        statusCode === 404 ? "Resource not found!": "Something went wrong! Please try again later."
    );
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
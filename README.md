# Student Task Manager

A full-stack task management web application built to help students organize their academic tasks, manage deadlines, and track their productivity.

## Features

### Task Management
- Create, edit, and delete tasks.
- Mark tasks as completed or incomplete.
- Assign Low, Medium, or High priority.
- Set deadlines for tasks.

### Search, Filter & Sort
- Search tasks by title or subject.
- Filter tasks by priority and completion status.
- Sort tasks by deadline.

### Dashboard
- View total, completed, and incomplete tasks.
- Track high-priority and overdue tasks.
- Monitor task completion percentage.

### User Authentication & Security
- User registration and login.
- Password hashing using bcrypt.
- Session-based authentication.
- User-specific task management and account isolation.
- Session invalidation after password changes.
- CSRF protection and security headers.
- Protected routes and input validation.

### Profile Management
- Update profile name.
- Change account password.

## Tech Stack

- **Frontend:** HTML, CSS, EJS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose
- **Authentication:** Express Session, bcrypt
- **Security:** Helmet, csrf-sync
- **Other:** dotenv, connect-mongo

## Project Structure

```text
student-task-manager/
├── models/
│   ├── Task.js
│   └── User.js
├── views/
│   ├── index.ejs
│   ├── edit.ejs
│   ├── register.ejs
│   ├── login.ejs
│   └── profile.ejs
├── public/
│   └── style.css
├── app.js
├── package.json
├── package-lock.json
├── .gitignore
└── .env
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the project directory

```bash
cd student-task-manager
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory and add:

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/studentTaskManager
NODE_ENV=development
SESSION_SECRET=your_secret_key
```

Replace `your_secret_key` with a strong, unique secret.

### 5. Start MongoDB

Make sure your MongoDB server is running locally.

### 6. Start the application

For normal startup:

```bash
npm start
```

For development with automatic server restarts:

```bash
npm run dev
```

### 7. Open the application

Visit the following URL in your browser:

http://localhost:8080


## Screenshots

Add screenshots of your application here:

- Dashboard
- Login page
- Registration page
- Add/Edit Task
- Profile page

## Security Notes

- Never commit your `.env` file.
- Use a strong, unique session secret.
- Configure secure cookies and HTTPS when deploying.

## Future Improvements

- Cloud deployment.
- Additional productivity and reporting features.

## Author

Developed as a full-stack web development project using Node.js, Express.js, EJS, and MongoDB.

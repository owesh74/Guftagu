

# 👻 Guftagu - Anonymous Group Chat

**Guftagu** (Conversation) is a privacy-focused, real-time group chat application that requires **no account creation**. Users can create secure rooms, join as unique characters using a PIN, and share messages and files anonymously.

🚀 **Live Demo:** [guftroom.vercel.app](https://www.google.com/search?q=https://guftroom.vercel.app)

-----

## ✨ Key Features

  * **🔒 Complete Anonymity:** No email, phone number, or signup required.
  * **⚡ Real-Time Messaging:** Powered by **Socket.io** for instant communication.
  * **🎭 Character System:** Join groups as a "Character" protected by a 4-digit PIN.
  * **📂 File Sharing:** Support for image and document uploads (up to 30MB).
  * **🛡️ Secure Groups:** Creators define custom group names.
  * **👮 Admin Panel:** Protected route for monitoring groups, messages, and managing content.
  * **📱 Responsive UI:** Clean, modern interface built with React & Vite.

-----

## 🛠️ Tech Stack

### **Frontend**

  * **React.js (Vite)** - Fast and modern UI library.
  * **Socket.io Client** - For real-time bidirectional event-based communication.
  * **Axios** - For HTTP requests.
  * **CSS3** - Custom styling with a modern dark theme.

### **Backend**

  * **Node.js & Express** - REST API and server logic.
  * **Socket.io** - Real-time websocket server.
  * **MongoDB & Mongoose** - NoSQL database for flexible data storage.
  * **Multer** - Handling multipart/form-data for file uploads.

-----

## 🚀 Repositories

  * **Frontend:** [github.com/owesh74/Guftagu](https://github.com/owesh74/Guftagu)
  * **Backend:** [github.com/owesh74/Guftagu-server](https://github.com/owesh74/Guftagu-server)

-----

## ⚙️ Installation & Setup

Follow these steps to run the project locally.

### 1\. Clone the Repositories

```bash
# Clone Frontend
git clone https://github.com/owesh74/Guftagu.git

# Clone Backend
git clone https://github.com/owesh74/Guftagu-server.git
```

### 2\. Backend Setup

Navigate to the server directory and install dependencies.

```bash
cd Guftagu-server
npm install
```

Create a `.env` file in the root of the server directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
ADMIN_PASSWORD=your_secret_admin_password
```

Start the server:

```bash
npm start
```

### 3\. Frontend Setup

Navigate to the client directory and install dependencies.

```bash
cd Guftagu
npm install
```

Create a `.env` file in the root of the client directory:

```env
# If running locally
VITE_API_BASE_URL=http://localhost:5000

# If connected to live backend
# VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

Start the client:

```bash
npm run dev
```

-----

## 📖 Usage Guide

1.  **Create a Group:**
      * Click "Create Group".
      * Enter a unique Group Name.
      * (Optional) Create your first Character (Name + 4-digit PIN).
2.  **Join a Group:**
      * Click "Open Existing Group" and enter the Group Name.
      * Choose to **Login** as an existing character (requires PIN) or **Create New** character.
3.  **Admin Access:**
      * Navigate to `/admin` in the URL.
      * Enter the password defined in your backend `.env` file.

-----

## ☁️ Deployment

  * **Frontend:** Deployed on [Vercel](https://vercel.com).
  * **Backend:** Deployed on [Render](https://render.com).
  * **Database:** Hosted on MongoDB Atlas.

-----

## 🤝 Contributing

Contributions are welcome\! Please fork the repository and create a pull request for any feature enhancements or bug fixes.

-----

## 👤 Author

**Owesh**

  * GitHub: [@owesh74](https://www.google.com/search?q=https://github.com/owesh74)
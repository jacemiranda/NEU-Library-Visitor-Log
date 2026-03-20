# NEU Library Visitor Log

This project was developed for the **Software Engineering 2** course to modernize the New Era University Library's entry process. It replaces the traditional manual pen-and-paper logbook with a secure, kiosk-oriented digital visitor management system.

Built with **React 19** and **Firebase**, the system allows students and faculty to seamlessly log their library visits using their institutional Google accounts, while providing administrators with a powerful dashboard to monitor and export visitor data.

**[Live Demo: https://neu-library-visitor-log-rust.vercel.app/]**

## 🚀 Features

### Streamlined Visitor Flow
*   **Secure Google Sign-In**: Restricted strictly to `@neu.edu.ph` accounts for institutional security.
*   **Quick Onboarding**: One-time setup for new users to set their role (Student, Faculty, or Employee) and department/college.
*   **One-Click Logging**: Fast visit logging with predefined reasons for returning users.
*   **QR Check-Out**: Unique QR code generation for secure and verifiable library exits.

### Admin Dashboard & Reporting
*   **Live Monitoring**: Real-time view of currently active visitors and today's total traffic.
*   **Advanced Analytics**: Visualizations for peak hours, department breakdowns, and visitor trends using Recharts.
*   **Data Export**: CSV export functionality for library attendance records and compliance reporting.
*   **User Management**: Tools to block/unblock users and view detailed individual visit histories.

### Modern UI/UX
*   **Deep Blue Theme**: A sophisticated dark mode design optimized for library environments.
*   **Responsive Design**: Fully optimized for shared kiosk displays, tablets, and desktop use.
*   **Smooth Interactions**: Fluid transitions and animations powered by `motion`.

## 🛠️ Tech Stack

*   **Frontend**: React 19, Vite, TypeScript
*   **Styling & UI**: Tailwind CSS 4, Lucide React, motion
*   **Backend & Database**: Firebase Authentication, Cloud Firestore
*   **Charts**: Recharts
*   **QR Logic**: `qrcode.react`, `html5-qrcode`

## 📦 Setup & Installation

### Prerequisites
*   Node.js 18 or later
*   A Firebase project with Authentication and Firestore enabled

### 1. Clone & Install
```bash
git clone https://github.com/your-username/neu-library-log.git
cd neu-library-log
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory (or add these to your Vercel project settings) with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_ID=(default)
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 📂 Project Structure (Core)

*   `src/App.tsx` - Main application logic, state management, and view routing.
*   `src/firebase.ts` - Firebase SDK initialization and configuration.
*   `src/types.ts` - TypeScript interfaces for User Profiles and Visitor Logs.
*   `firestore.rules` - Security rules for protecting visitor data.


## 🛡️ Security Rules

Deploy the included security rules to your Firebase project:
```bash
firebase deploy --only firestore:rules
```

## ✍️ Author

**Jermaine Carl Miranda**

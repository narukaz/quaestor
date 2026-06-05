# Quaestor: Your Personal Expense Tracker (Backend)

## How to Run the Project Locally

1. **Install dependencies**:
   Run `npm install` (or `npm i`) to install all the required packages from `package.json`.
   ```bash
   npm install
   ```

2. **Configure Database**:
   Deploy a local instance of MongoDB, or create a `.env` file in the root directory and pass your custom `MONGODB_URI` connection string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/quaestor
   ```

3. **Start the server**:
   Run the following command to start the server:
   ```bash
   node index.js
   ```
   *Note: If you make any code changes after starting the server, you will need to kill the process and restart it.*

## Future Improvements & Features

We plan to add the following features in future updates:
- **Payment App Integrations**: APIs to connect with daily-use apps like Google Pay, BHIM, and Paytm.
- **Email Reports**: Automated email delivery of financial summaries and reports.
- **Custom Groups**: Support for creating more budget groups beyond just "Personal" and "Family".

---

## Test Account Credentials

The database has been seeded with the following test accounts:

### 1. Main Demo Account
- **Name**: Omveer Singh
- **Email**: `omveer@quaestor.app`
- **Username**: `omveer99`
- **Password**: `omveer123`

### 2. Seeded Family Group Members
All three users below are part of the **"Doe & Friends Family"** group and have active transactions loaded.
- **User 1 (Admin/Creator)**:
  - **Name**: John Doe
  - **Email**: `john@quaestor.app`
  - **Username**: `johndoe`
  - **Password**: `password123`
- **User 2**:
  - **Name**: Mary Smith
  - **Email**: `mary@quaestor.app`
  - **Username**: `marysmith`
  - **Password**: `password123`
- **User 3**:
  - **Name**: David Jones
  - **Email**: `david@quaestor.app`
  - **Username**: `davidjones`
  - **Password**: `password123`

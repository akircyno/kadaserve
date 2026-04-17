# KadaServe

## Installation

Follow these steps to set up KadaServe on your local machine:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/kadaserve.git
   cd kadaserve/frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   - Create a `.env.local` file in the `frontend` directory and add:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key
   SUPABASE_SERVICE_ROLE_KEY=your_secret_key
   ```

4. **Verify Setup**:
   - Ensure Node.js is installed: `node --version`
   - Confirm dependencies are installed without errors:
     ```bash
     npm install
     ```

---

## Running KadaServe Locally

To run KadaServe on your machine:

1. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   This will launch the app, typically at `http://localhost:3000`.

2. **Access the Application**:
   - Open your browser and navigate to `http://localhost:3000` (or the port specified in the terminal).

3. **Expected Result**:
   - The application should load successfully.
   - Menu items should be displayed if the database is connected properly.

---

## Test Accounts

If user registration is not yet implemented, create test users manually in Supabase Authentication.

**Customer**
- Email: `customer@gmail.com`
- Password: `customer123`

**Staff**
- Email: `staff@kadaserve.ph`
- Password: `staff123`

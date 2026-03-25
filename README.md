# ⚽ GoalScrape: Football Data Automation

Automate the extraction of live football data using Selenium.

## 🚀 How to Run

1.  **Clone / Open the project**: Ensure you are in `f:\selinium\GoalScrape`.
2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run the scraper**:
    ```bash
    python scraper/main.py
    ```

## 📂 Project Structure

- `scraper/main.py`: The core automation logic using Selenium.
- `server/`: Node.js Express backend serving the CSV data.
- `client/`: React Frontend dashboard.
- `data/`: Folder where extracted CSV data is saved.

## ⚙️ How to Start the Entire System

### 1. Scraper (Python)
```bash
pip install -r requirements.txt

# Run once normally:
python scraper/main.py

# Or run automatically in the background (every minute):
python scraper/main.py --background --headless
```

### 2. Backend (Node.js)
In the `server/` directory:
```bash
npm install
npm start
```
API running on: `http://localhost:5000/api/matches`

### 3. Frontend (React)
In the `client/` directory:
```bash
npm install
npm run dev
```
Dashboard running on: `http://localhost:5173`

---

Developed with ❤️ using Selenium and Python.

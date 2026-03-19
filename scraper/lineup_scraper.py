import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def get_lineups(match_id):
    url = f"https://www.flashscore.com/match/{match_id}/#/match-summary/lineups"
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 15)
    
    try:
        driver.get(url)
        
        # 1. WAIT FOR ANY PLAYER TO APPEAR ON THE PITCH (Using data-testid)
        try:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='wcl-lineupsParticipantName']")))
        except:
            time.sleep(5) # Fallback

        results = {"home": [], "away": []}
        
        # 2. SEPARATE TEAMS USING DATA CONTAINERS
        # Flashscore usually places Home team in the first 'lf__formation' and Away in 'lf__formationAway'
        try:
            # Home logic
            home_container = driver.find_element(By.CSS_SELECTOR, ".lf__formation:not(.lf__formationAway)")
            players = home_container.find_elements(By.CSS_SELECTOR, "[data-testid='wcl-participantPitch']")
            for p in players:
                try:
                    name_el = p.find_element(By.CSS_SELECTOR, "[data-testid='wcl-lineupsParticipantName']")
                    name = name_el.text.strip()
                    num = p.find_element(By.CSS_SELECTOR, "[class*='participantNumber']").text.strip()
                    results["home"].append({"name": name, "num": num, "pos": ""})
                except: continue
                
            # Away logic
            away_container = driver.find_element(By.CSS_SELECTOR, ".lf__formationAway")
            players = away_container.find_elements(By.CSS_SELECTOR, "[data-testid='wcl-participantPitch']")
            for p in players:
                try:
                    name_el = p.find_element(By.CSS_SELECTOR, "[data-testid='wcl-lineupsParticipantName']")
                    name = name_el.text.strip()
                    num = p.find_element(By.CSS_SELECTOR, "[class*='participantNumber']").text.strip()
                    results["away"].append({"name": name, "num": num, "pos": ""})
                except: continue
        except: pass

        # 3. IF PITCH VIEW FAILS, TRY THE LIST TAB
        if not results["home"]:
            # Sometimes data-testid is also in the list view
            all_name_els = driver.find_elements(By.CSS_SELECTOR, "[data-testid='wcl-lineupsParticipantName']")
            if len(all_name_els) >= 22:
                for i, el in enumerate(all_name_els[:22]):
                    if i < 11: results["home"].append({"name": el.text.strip(), "num": "", "pos": ""})
                    else: results["away"].append({"name": el.text.strip(), "num": "", "pos": ""})

        if not results["home"]:
             return {"error": "Lineups recorded as Success but no names extracted. Layout might be blocked."}

        return results
        
    except Exception as e:
        return {"error": f"Scraper Crash: {str(e)}"}
    finally:
        driver.quit()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        match_id = sys.argv[1]
        lineups = get_lineups(match_id)
        sys.stdout.write(json.dumps(lineups))
    else:
        sys.stdout.write(json.dumps({"error": "No ID"}))

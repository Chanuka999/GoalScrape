import os
import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

class FootballScraper:
    def __init__(self, headless=False):
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        self.wait = WebDriverWait(self.driver, 30)

    def scrape_flashscore_live(self):
        url = "https://www.flashscore.com/soccer/live/"
        print(f"--- [GOALSCRAPE V6.0 - MATCH-ID CAPTURE] ---")
        print(f"Opening {url}...")
        self.driver.get(url)
        time.sleep(15) 
        
        try:
            # Handle cookie consent
            try:
                cookie_btn = self.driver.find_element(By.ID, "onetrust-accept-btn-handler")
                cookie_btn.click()
            except:
                pass

            print("Extracting match data...")
            match_rows = self.driver.find_elements(By.CSS_SELECTOR, "div[class*='event__match']")
            print(f"Found {len(match_rows)} matches.")
            
            data = []
            
            for row in match_rows:
                try:
                    # Capture Match ID (looks like g_1_xxxxxxxx)
                    full_id = row.get_attribute("id")
                    match_id = full_id.replace("g_1_", "") if full_id else ""

                    # 1. LEAGUE NAME
                    try:
                        league_el = row.find_element(By.XPATH, "./preceding-sibling::div[contains(@class, 'header') or contains(@class, 'title') or contains(@class, 'heading') or contains(@class, 'category')][1]")
                        try:
                            league_name = league_el.find_element(By.CSS_SELECTOR, "[class*='name'], [class*='title']").text.strip()
                        except:
                            league_name = league_el.text.split('\n')[0].strip()
                    except:
                        league_name = "Other Matches"

                    # 2. TEAMS
                    home_team = row.find_element(By.CSS_SELECTOR, "div[class*='homeParticipant']").text.strip()
                    away_team = row.find_element(By.CSS_SELECTOR, "div[class*='awayParticipant']").text.strip()

                    # 3. SCORES
                    try:
                        h_score = row.find_element(By.CSS_SELECTOR, ".event__score--home").text.strip()
                        a_score = row.find_element(By.CSS_SELECTOR, ".event__score--away").text.strip()
                        score = f"{h_score} - {a_score}"
                    except:
                        score = "0 - 0"

                    # 4. TIME
                    try:
                        time_val = row.find_element(By.CSS_SELECTOR, "div[class*='stage'], div[class*='time']").text.strip()
                    except:
                        time_val = "LIVE"
                    
                    data.append({
                        "MatchID": match_id,
                        "League": league_name if league_name else "Other Matches",
                        "Time": time_val,
                        "Home Team": home_team,
                        "Away Team": away_team,
                        "Score": score
                    })
                except:
                    continue
            
            return data
            
        except Exception as e:
            print(f"Error: {e}")
            return []

    def close(self):
        try:
            self.driver.quit()
        except:
            pass

    def save_to_csv(self, data, filename="live_matches.csv"):
        if not data:
            print("No data collected.")
            return
        
        df = pd.DataFrame(data)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(script_dir)
        save_path = os.path.join(root_dir, "data", filename)
        
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        # Ensure MatchID is included
        cols = ["MatchID", "League", "Time", "Home Team", "Away Team", "Score"]
        df = df[cols]
        df.to_csv(save_path, index=False)
        print(f"SUCCESS: Saved {len(df)} matches with IDs.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GoalScrape Football Scraper")
    parser.add_argument("--background", action="store_true", help="Run continuously in the background")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    args = parser.parse_args()

    scraper = FootballScraper(headless=args.headless or args.background)
    
    try:
        if args.background:
            print("Starting background automated scraper. Scraping every 60 seconds...")
            while True:
                print("\n[Background Job] Fetching live data...")
                live_data = scraper.scrape_flashscore_live()
                scraper.save_to_csv(live_data)
                print("[Background Job] Waiting 60 seconds before next scrape...")
                time.sleep(60)
        else:
            live_data = scraper.scrape_flashscore_live()
            scraper.save_to_csv(live_data)
    except KeyboardInterrupt:
        print("\nStopping scraper...")
    finally:
        scraper.close()

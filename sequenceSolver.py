import requests
import json

def search_oeis(sequence_str):
    # Clean the input: OEIS search ignores spaces but can trip up on '?'.
    # We replace '?' so it can fuzzy match the remaining valid terms.
    query = sequence_str.replace('?', ' ').replace(', ,', ',')
    
    url = "https://oeis.org/search"
    params = {
        "q": query,
        "fmt": "json"
    }
    
    try:
        # Send the GET request to the OEIS API
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        # Handle empty responses
        if not response.text.strip():
             return "No sequence found on OEIS."
             
        data = response.json()
        
        # OEIS usually returns a list of dictionaries, or a dict containing 'results'
        if isinstance(data, list) and len(data) > 0:
            first_result = data[0]
        elif isinstance(data, dict) and data.get("results") and len(data["results"]) > 0:
            first_result = data["results"][0]
        else:
            return "No matching sequence found."
            
        # Extract the key details
        oeis_id = f"A{first_result.get('number', 0):06d}"
        name = first_result.get('name', 'No name provided.')
        full_sequence = first_result.get('data', 'No sequence data provided.')
        
        # Formulas are usually returned as a list of strings
        formulas = first_result.get('formula', [])
        pattern = "\n".join(formulas) if formulas else "No mathematical pattern/formula provided."
        
        return {
            "ID": oeis_id,
            "Name": name,
            "Sequence": full_sequence,
            "Pattern": pattern
        }

    except requests.exceptions.RequestException as e:
        return f"Network error occurred: {e}"
    except ValueError:
        return "Failed to parse the data from OEIS."

# --- Example Usage ---
if __name__ == "__main__":
    # A sequence with a missing term ('?') 
    test_sequence = input()
    
    result = search_oeis(test_sequence)
    
    if isinstance(result, dict):
        print(f"[{result['ID']}] {result['Name']}")
        print("end 1")
        print(f"Full Sequence: {result['Sequence']}")
        print("end 2")
        print(f"\nPattern/Formula:\n{result['Pattern'][:200] + '... (truncated)' if len(result['Pattern']) > 200 else result['Pattern']}")
    else:
        print(result)
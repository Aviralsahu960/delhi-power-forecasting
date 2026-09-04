def check_alert(predicted_load_mw: float, capacity_mw: float = 35000) -> str:
    """
    Evaluate grid capacity alert.
    Capacity set to 35,000 MW to match Delhi's actual grid scale
    (24-hour dataset shows peaks up to 31,138 MW).
    - CRITICAL : >= 95% of capacity
    - WARNING  : >= 85% of capacity
    - Normal   : below warning threshold
    """
    if predicted_load_mw >= 0.95 * capacity_mw:
        return "CRITICAL"
    elif predicted_load_mw >= 0.85 * capacity_mw:
        return "WARNING"
    else:
        return "Normal"


if __name__ == "__main__":
    for load in [33000, 30000, 25000, 18000]:
        print(f"{load} MW → {check_alert(load)}")

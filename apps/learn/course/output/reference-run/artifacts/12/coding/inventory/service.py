def remaining(stock, requested):
    if requested < 0 or requested > stock:
        raise ValueError("invalid quantity")
    return stock - requested

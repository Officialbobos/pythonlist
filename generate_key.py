# generate_key.py
import secrets

secret_key = secrets.token_hex(24) # Generates 24 random bytes (48 hex characters)
print(secret_key)
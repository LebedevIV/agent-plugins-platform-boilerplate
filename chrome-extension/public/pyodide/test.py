print("Hello from Pyodide inline execution!")
print(f"Python version: {__import__('sys').version}")

# Test basic math
result = 42 * 2 + 10
print(f"Math result: {result}")

# Test js bridge
js.console.log("Message from Python to JS console")

print("test completed successfully")
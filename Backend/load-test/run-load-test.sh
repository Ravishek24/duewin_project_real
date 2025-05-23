#!/bin/bash

# Create results directory if it doesn't exist
mkdir -p results

# Get current timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Run the load test
echo "Starting load test..."
artillery run --output results/load_test_${TIMESTAMP}.json load-test.yml

# Generate HTML report
echo "Generating report..."
artillery report --output results/load_test_${TIMESTAMP}.html results/load_test_${TIMESTAMP}.json

echo "Load test completed. Results saved in results/load_test_${TIMESTAMP}.html" 
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/', methods=['GET'])
def health_check():
    """Basic health check route."""
    return jsonify({
        "status": "online",
        "message": "Thermopolis backend architecture is live."
    }), 200

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Placeholder endpoint for future Machine Learning integration.
    Currently does nothing but return a dummy response.
    """
    data = request.json
    return jsonify({
        "status": "success",
        "prediction": "Placeholder ML prediction",
        "received_data": data
    }), 200

if __name__ == '__main__':
    # Run the server in debug mode for development
    app.run(host='0.0.0.0', port=5000, debug=True)

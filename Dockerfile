# Options Buddy Backend - Production Dockerfile
FROM python:3.11-slim

# Set working directory to backend
WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Expose port (Railway uses $PORT)
EXPOSE 8000

# Run the production server
CMD ["python", "-m", "uvicorn", "main_production:app", "--host", "0.0.0.0", "--port", "8000"]

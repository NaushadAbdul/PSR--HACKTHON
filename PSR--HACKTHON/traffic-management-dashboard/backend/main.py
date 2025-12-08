from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uvicorn
import cv2
import numpy as np
from datetime import datetime, timedelta
import logging
import asyncio
import json
import os
from pathlib import Path

# Import our services
from services.video_processor import VideoProcessor
from ai.detection import TrafficAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create data directories
os.makedirs('data/violations', exist_ok=True)
os.makedirs('data/static', exist_ok=True)

app = FastAPI(
    title="AI Traffic Management System",
    description="API for intelligent traffic management and violation detection",
    version="1.0.0"
)

# Initialize services
video_processor = VideoProcessor(output_dir='data/violations')
traffic_analyzer = TrafficAnalyzer()

# WebSocket connections
active_connections: List[WebSocket] = []

# Mount static files
app.mount("/static", StaticFiles(directory="data/static"), name="static")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class TrafficData(BaseModel):
    camera_id: str
    vehicle_count: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    lane_id: str
    image_path: Optional[str] = None

class ViolationData(BaseModel):
    violation_type: str  # no_helmet, no_seatbelt, triple_riding, wrong_way
    license_plate: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    camera_id: str
    confidence: float
    image_path: Optional[str] = None
    bbox: Optional[List[int]] = None
    plate_bbox: Optional[List[int]] = None

class TrafficLightState(BaseModel):
    intersection_id: str
    phase: str  # 'red', 'yellow', 'green'
    duration: int  # in seconds
    next_change: Optional[datetime] = None

class SystemStatus(BaseModel):
    status: str
    cameras: List[Dict[str, Any]]
    violations_today: int
    avg_response_time: float
    uptime: str
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class CameraFeed(BaseModel):
    id: str
    name: str
    location: str
    status: str  # 'online', 'offline', 'error'
    last_active: Optional[datetime] = None
    stream_url: Optional[str] = None

class TrafficStats(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    vehicle_count: int
    avg_speed: Optional[float] = None
    congestion_level: float  # 0-100
    violations: Dict[str, int]  # violation_type: count

# In-memory storage (replace with database in production)
traffic_data_store = []
violations_store = []
camera_feeds: Dict[str, CameraFeed] = {}

# Initialize with some test cameras
camera_feeds = {
    'cam-001': CameraFeed(
        id='cam-001',
        name='Main Intersection',
        location='MG Road & Brigade Road',
        status='online',
        last_active=datetime.utcnow(),
        stream_url='rtsp://example.com/stream1'
    ),
    'cam-002': CameraFeed(
        id='cam-002',
        name='Downtown',
        location='100ft Road, Indiranagar',
        status='online',
        last_active=datetime.utcnow(),
        stream_url='rtsp://example.com/stream2'
    ),
}

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Remaining connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

# Register callbacks
def on_violation_detected(violation_data: Dict):
    """Callback for when a violation is detected."""
    violations_store.append(violation_data)
    
    # Broadcast to WebSocket clients
    event = {
        'type': 'violation',
        'data': violation_data,
        'timestamp': datetime.utcnow().isoformat()
    }
    asyncio.create_task(manager.broadcast(json.dumps(event, default=str)))

# Register the callback
video_processor.register_callback('violation', on_violation_detected)

# Utility functions
def save_upload_file(file: UploadFile, destination: Path) -> str:
    """Save an uploaded file to the specified destination."""
    try:
        file_path = destination / file.filename
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())
        return str(file_path.relative_to('data/static'))
    except Exception as e:
        logger.error(f"Error saving file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save file")

# API Endpoints
@app.post("/api/traffic/analyze")
async def analyze_traffic(
    camera_id: str = Form(...),
    image: UploadFile = File(...),
    timestamp: Optional[datetime] = Form(None)
):
    """
    Analyze traffic from a camera feed image
    """
    try:
        if camera_id not in camera_feeds:
            raise HTTPException(status_code=404, detail="Camera not found")
        
        # Read and process the image
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        # Process the frame
        processed_frame, results = video_processor._process_frame(img)
        
        # Save the processed image
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        image_path = f"static/processed_{camera_id}_{timestamp_str}.jpg"
        cv2.imwrite(f"data/{image_path}", processed_frame)
        
        # Create traffic data
        traffic_data = TrafficData(
            camera_id=camera_id,
            vehicle_count=len(results['vehicles']),
            lane_id="default",
            image_path=f"/{image_path}"
        )
        traffic_data_store.append(traffic_data)
        
        # Update camera last active time
        camera_feeds[camera_id].last_active = datetime.utcnow()
        
        # Broadcast update to WebSocket clients
        update = {
            'type': 'traffic_update',
            'camera_id': camera_id,
            'vehicle_count': len(results['vehicles']),
            'violations': {
                'no_helmet': len(results['violations']['no_helmet']),
                'no_seatbelt': len(results['violations']['no_seatbelt']),
                'triple_riding': len(results['violations']['triple_riding']),
                'wrong_way': len(results['violations']['wrong_way'])
            },
            'timestamp': datetime.utcnow().isoformat(),
            'image_url': f"/{image_path}"
        }
        await manager.broadcast(json.dumps(update, default=str))
        
        return {
            "status": "success",
            "vehicle_count": len(results['vehicles']),
            "violations_detected": sum(len(v) for v in results['violations'].values()),
            "processed_image": f"/{image_path}",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/traffic/summary")
async def get_traffic_summary(hours: int = 24):
    """
    Get traffic summary statistics
    
    Args:
        hours: Number of hours to look back for statistics (default: 24)
    """
    if not traffic_data_store:
        return {"message": "No traffic data available"}
    
    # Filter data for the specified time window
    time_threshold = datetime.utcnow() - timedelta(hours=hours)
    recent_data = [d for d in traffic_data_store if d.timestamp >= time_threshold]
    
    if not recent_data:
        return {"message": f"No data available for the last {hours} hours"}
    
    # Calculate statistics
    total_vehicles = sum(d.vehicle_count for d in recent_data)
    avg_vehicles = total_vehicles / len(recent_data)
    
    # Get violation counts by type
    violation_counts = {}
    for v in violations_store:
        if isinstance(v, dict):
            v_type = v.get('violation_type', 'unknown')
        else:
            v_type = v.violation_type
        violation_counts[v_type] = violation_counts.get(v_type, 0) + 1
    
    # Get recent violations
    recent_violations = [v for v in violations_store 
                        if (isinstance(v, dict) and v.get('timestamp', datetime.min) >= time_threshold) or 
                           (hasattr(v, 'timestamp') and v.timestamp >= time_threshold)]
    
    return {
        "time_period_hours": hours,
        "total_vehicles_tracked": total_vehicles,
        "average_vehicles_per_reading": round(avg_vehicles, 2),
        "total_readings": len(recent_data),
        "violation_counts": violation_counts,
        "total_violations": len(recent_violations),
        "last_updated": datetime.utcnow().isoformat(),
        "cameras_online": sum(1 for cam in camera_feeds.values() if cam.status == 'online'),
        "cameras_total": len(camera_feeds)
    }

@app.get("/api/violations/recent")
async def get_recent_violations(
    limit: int = 10,
    violation_type: Optional[str] = None,
    camera_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """
    Get recent traffic violations with filtering options
    """
    filtered = violations_store.copy()
    
    # Apply filters
    if violation_type:
        filtered = [v for v in filtered 
                   if (isinstance(v, dict) and v.get('violation_type') == violation_type) or
                      (hasattr(v, 'violation_type') and v.violation_type == violation_type)]
    
    if camera_id:
        filtered = [v for v in filtered 
                   if (isinstance(v, dict) and v.get('camera_id') == camera_id) or
                      (hasattr(v, 'camera_id') and v.camera_id == camera_id)]
    
    if start_date:
        filtered = [v for v in filtered 
                   if (isinstance(v, dict) and v.get('timestamp', datetime.min) >= start_date) or
                      (hasattr(v, 'timestamp') and v.timestamp >= start_date)]
    
    if end_date:
        filtered = [v for v in filtered 
                   if (isinstance(v, dict) and v.get('timestamp', datetime.max) <= end_date) or
                      (hasattr(v, 'timestamp') and v.timestamp <= end_date)]
    
    # Sort by timestamp (newest first)
    filtered.sort(
        key=lambda x: x.get('timestamp') if isinstance(x, dict) else x.timestamp,
        reverse=True
    )
    
    # Apply limit
    result = filtered[:min(limit, len(filtered))]
    
    # Convert to dict if needed
    result = [v.dict() if hasattr(v, 'dict') else v for v in result]
    
    return {
        "violations": result,
        "total_count": len(filtered),
        "filters": {
            "violation_type": violation_type,
            "camera_id": camera_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
    }

@app.post("/api/traffic-lights/optimize")
async def optimize_traffic_lights():
    """
    Optimize traffic light timings based on current traffic conditions
    
    This endpoint analyzes current traffic patterns and suggests optimal
    traffic light timings to reduce congestion and improve flow.
    """
    try:
        # Get current traffic data
        summary = await get_traffic_summary(hours=1)  # Last hour of data
        
        # In a real implementation, this would use more sophisticated algorithms
        # and consider real-time data from multiple intersections
        
        # Simple optimization based on vehicle count
        avg_vehicles = summary.get('average_vehicles_per_reading', 0)
        
        # Base green light duration (seconds)
        base_green = 30
        
        # Adjust based on traffic density
        if avg_vehicles > 50:
            # Heavy traffic - longer green time
            green_duration = min(90, base_green * 1.5)  # Cap at 90 seconds
            reason = "Heavy traffic detected - extended green time"
        elif avg_vehicles > 20:
            # Moderate traffic - standard timing
            green_duration = base_green
            reason = "Moderate traffic - standard timing"
        else:
            # Light traffic - shorter cycles
            green_duration = max(20, base_green * 0.75)  # At least 20 seconds
            reason = "Light traffic - reduced cycle time"
        
        # Get list of known intersections from camera feeds
        intersections = {}
        for cam_id, cam in camera_feeds.items():
            # In a real system, we'd have mapping of cameras to intersections
            intersection_id = f"int-{cam_id.split('-')[-1]}"
            
            # Get recent traffic for this camera
            cam_traffic = [d for d in traffic_data_store 
                          if hasattr(d, 'camera_id') and d.camera_id == cam_id]
            
            if cam_traffic:
                # Get average vehicle count for this camera
                avg_vehicles = sum(d.vehicle_count for d in cam_traffic) / len(cam_traffic)
                
                # Simple logic to determine phase
                if avg_vehicles > 10:
                    phase = "green"
                    duration = int(green_duration)
                else:
                    phase = "red"
                    duration = max(20, int(green_duration * 0.67))
                
                intersections[intersection_id] = {
                    "phase": phase,
                    "duration": duration,
                    "reason": f"Average {avg_vehicles:.1f} vehicles per reading"
                }
        
        # If no camera-specific data, return a default optimization
        if not intersections:
            intersections = {
                "default_intersection": {
                    "phase": "green",
                    "duration": int(green_duration),
                    "reason": reason
                }
            }
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "optimization": intersections,
            "metadata": {
                "avg_vehicles_per_reading": avg_vehicles,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "model_version": "1.0"
            }
        }
        
    except Exception as e:
        logger.error(f"Error optimizing traffic lights: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time updates
@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
            # Send a ping periodically
            await asyncio.sleep(10)
            await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Camera management endpoints
@app.get("/api/cameras", response_model=List[CameraFeed])
async def list_cameras():
    """Get list of all camera feeds"""
    return list(camera_feeds.values())

@app.get("/api/cameras/{camera_id}", response_model=CameraFeed)
async def get_camera(camera_id: str):
    """Get details for a specific camera"""
    if camera_id not in camera_feeds:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera_feeds[camera_id]

# System status endpoint
@app.get("/api/status", response_model=SystemStatus)
async def get_system_status():
    """Get current system status and health"""
    return SystemStatus(
        status="operational",
        cameras=[cam.dict() for cam in camera_feeds.values()],
        violations_today=len([v for v in violations_store 
                            if (isinstance(v, dict) and v.get('timestamp', datetime.min).date() == datetime.utcnow().date()) or
                               (hasattr(v, 'timestamp') and v.timestamp.date() == datetime.utcnow().date())]),
        avg_response_time=0.15,  # Mock value
        uptime=str(datetime.utcnow() - datetime(2023, 1, 1)),  # Mock uptime
        last_updated=datetime.utcnow()
    )

# Start the video processor when the app starts
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting up traffic management system...")
    
    # In a production environment, you would load camera configurations from a database
    # and start processing each camera feed
    # for camera_id, camera in camera_feeds.items():
    #     if camera.status == 'online' and camera.stream_url:
    #         video_processor.start_processing(camera.stream_url)
    
    logger.info("Traffic management system started successfully")

# Cleanup on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down traffic management system...")
    video_processor.stop_processing()
    logger.info("Cleanup complete")

if __name__ == "__main__":
    # Create necessary directories
    os.makedirs("data/violations", exist_ok=True)
    os.makedirs("data/static", exist_ok=True)
    
    # Start the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=4,
        log_level="info"
    )

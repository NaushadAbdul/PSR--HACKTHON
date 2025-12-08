import cv2
import numpy as np
import torch
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import logging
from datetime import datetime
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ViolationDetector:
    def __init__(self, model_path: str = None, device: str = None):
        """
        Initialize the violation detector with YOLOv5 model.
        
        Args:
            model_path: Path to the YOLOv5 model weights
            device: Device to run inference on ('cuda' or 'cpu')
        """
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {self.device}")
        
        # Load YOLOv5 model
        try:
            self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
            self.model.to(self.device)
            self.model.eval()
            logger.info("YOLOv5 model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading YOLOv5 model: {str(e)}")
            raise
        
        # Define class names and violation-related classes
        self.class_names = self.model.names
        self.vehicle_classes = [2, 3, 5, 7]  # COCO classes: car, motorcycle, bus, truck
        self.person_class = 0  # COCO class: person
        
        # Violation detection parameters
        self.helmet_model = None  # Placeholder for helmet detection model
        self.seatbelt_model = None  # Placeholder for seatbelt detection model
        
    def detect_vehicles(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect vehicles in the frame.
        
        Args:
            frame: Input BGR image
            
        Returns:
            List of detected vehicles with their properties
        """
        # Run inference
        results = self.model(frame)
        
        # Filter vehicle detections
        detections = []
        for *xyxy, conf, cls in results.xyxy[0]:
            if int(cls) in self.vehicle_classes:
                x1, y1, x2, y2 = map(int, xyxy)
                detections.append({
                    'class_id': int(cls),
                    'class_name': self.class_names[int(cls)],
                    'bbox': [x1, y1, x2, y2],
                    'confidence': float(conf),
                    'track_id': None  # Will be used for tracking
                })
                
        return detections
    
    def detect_violations(self, frame: np.ndarray) -> Dict:
        """
        Detect traffic violations in the frame.
        
        Args:
            frame: Input BGR image
            
        Returns:
            Dictionary containing detected violations
        """
        violations = {
            'no_helmet': [],
            'no_seatbelt': [],
            'triple_riding': [],
            'wrong_way': []
        }
        
        # Run object detection
        results = self.model(frame)
        
        # Get detections
        bboxes = results.xyxy[0].cpu().numpy()
        
        # Process detections for violations
        for *xyxy, conf, cls in bboxes:
            x1, y1, x2, y2 = map(int, xyxy)
            class_id = int(cls)
            
            # Detect no-helmet and triple riding for motorcycles
            if class_id == 3:  # Motorcycle
                # Get all persons in the vicinity of the motorcycle
                riders = self._find_riders(bboxes, [x1, y1, x2, y2])
                
                # Check for no-helmet
                for rider in riders:
                    if not self._is_wearing_helmet(frame, rider['bbox']):
                        violations['no_helmet'].append({
                            'bbox': rider['bbox'],
                            'confidence': rider['confidence'],
                            'vehicle_bbox': [x1, y1, x2, y2]
                        })
                
                # Check for triple riding
                if len(riders) >= 3:
                    violations['triple_riding'].append({
                        'bbox': [x1, y1, x2, y2],
                        'confidence': float(conf),
                        'rider_count': len(riders)
                    })
            
            # Detect no-seatbelt for cars
            elif class_id == 2:  # Car
                if not self._is_wearing_seatbelt(frame, [x1, y1, x2, y2]):
                    violations['no_seatbelt'].append({
                        'bbox': [x1, y1, x2, y2],
                        'confidence': float(conf)
                    })
            
            # Check for wrong-way driving (simplified - would need additional logic)
            # This is a placeholder - actual implementation would require tracking
            # and analyzing vehicle direction against road direction
            
        return violations
    
    def _find_riders(self, all_detections: np.ndarray, bike_bbox: List[int]) -> List[Dict]:
        """Find persons that are likely riding the motorcycle."""
        riders = []
        bike_x1, bike_y1, bike_x2, bike_y2 = bike_bbox
        bike_center = ((bike_x1 + bike_x2) // 2, (bike_y1 + bike_y2) // 2)
        
        for *xyxy, conf, cls in all_detections:
            if int(cls) == self.person_class:  # Person class
                x1, y1, x2, y2 = map(int, xyxy)
                person_center = ((x1 + x2) // 2, (y1 + y2) // 2)
                
                # Check if person is within a certain distance from the bike
                if (abs(person_center[0] - bike_center[0]) < 100 and 
                    abs(person_center[1] - bike_center[1]) < 100):
                    riders.append({
                        'bbox': [x1, y1, x2, y2],
                        'confidence': float(conf)
                    })
        
        return riders
    
    def _is_wearing_helmet(self, frame: np.ndarray, person_bbox: List[int]) -> bool:
        """Check if a person is wearing a helmet."""
        # This is a simplified version - in practice, you would use a helmet detection model
        # Here we'll just return a random value for demonstration
        return np.random.random() > 0.5  # 50% chance of detection
    
    def _is_wearing_seatbelt(self, frame: np.ndarray, car_bbox: List[int]) -> bool:
        """Check if the driver is wearing a seatbelt."""
        # This is a simplified version - in practice, you would use a seatbelt detection model
        # Here we'll just return a random value for demonstration
        return np.random.random() > 0.3  # 70% chance of detection
    
    def detect_license_plate(self, frame: np.ndarray, vehicle_bbox: List[int]) -> Optional[Dict]:
        """
        Detect and recognize license plate from vehicle image.
        
        Args:
            frame: Input BGR image
            vehicle_bbox: Bounding box of the vehicle [x1, y1, x2, y2]
            
        Returns:
            Dictionary with license plate information or None if not found
        """
        # This is a placeholder - in practice, you would use an ANPR (Automatic Number Plate Recognition) model
        # For demonstration, we'll return a mock license plate sometimes
        if np.random.random() > 0.7:  # 30% chance of detecting a plate
            return {
                'number': f"KA{np.random.randint(1, 100):02d}AB{np.random.randint(1000, 9999)}",
                'confidence': 0.9,
                'bbox': [
                    vehicle_bbox[0] + 10,
                    vehicle_bbox[1] + 10,
                    vehicle_bbox[2] - 10,
                    vehicle_bbox[1] + 40  # Approximate plate position
                ]
            }
        return None

class TrafficAnalyzer:
    """Class for analyzing traffic flow and generating statistics."""
    
    def __init__(self):
        self.vehicle_count_history = []
        self.max_history = 100  # Keep last 100 data points
        
    def update_vehicle_count(self, count: int, timestamp: float = None):
        """Update vehicle count history."""
        if timestamp is None:
            timestamp = datetime.now().timestamp()
            
        self.vehicle_count_history.append({
            'timestamp': timestamp,
            'count': count
        })
        
        # Keep only the most recent data points
        if len(self.vehicle_count_history) > self.max_history:
            self.vehicle_count_history = self.vehicle_count_history[-self.max_history:]
    
    def get_traffic_density(self, window_minutes: int = 5) -> float:
        """Calculate traffic density over the specified time window."""
        if not self.vehicle_count_history:
            return 0.0
            
        window_seconds = window_minutes * 60
        now = datetime.now().timestamp()
        
        # Get counts within the time window
        recent_counts = [
            point['count'] for point in self.vehicle_count_history
            if (now - point['timestamp']) <= window_seconds
        ]
        
        if not recent_counts:
            return 0.0
            
        # Simple average as density metric
        return sum(recent_counts) / len(recent_counts)
    
    def predict_congestion(self, lookahead_minutes: int = 5) -> float:
        """Predict congestion level in the next X minutes."""
        # This is a simplified predictor - in practice, you would use time series forecasting
        if len(self.vehicle_count_history) < 2:
            return 0.0
            
        # Simple linear extrapolation
        recent = self.vehicle_count_history[-10:]  # Last 10 data points
        if len(recent) < 2:
            return recent[0]['count'] if recent else 0.0
            
        # Calculate trend (simple linear regression)
        x = np.array([(point['timestamp'] - recent[0]['timestamp']) / 60 for point in recent])
        y = np.array([point['count'] for point in recent])
        
        if len(x) > 1 and np.ptp(x) > 0:  # Check if we have enough data
            z = np.polyfit(x, y, 1)
            p = np.poly1d(z)
            predicted = p(x[-1] + lookahead_minutes)
            return max(0, predicted)  # Don't return negative counts
        
        return y[-1]  # Return last known count if prediction not possible

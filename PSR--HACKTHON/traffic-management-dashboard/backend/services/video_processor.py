import cv2
import numpy as np
import time
import threading
import logging
from typing import Optional, Dict, List, Callable
from pathlib import Path
from datetime import datetime
import json

from ..ai.detection import ViolationDetector, TrafficAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VideoProcessor:
    def __init__(self, output_dir: str = "data/violations"):
        """
        Initialize the video processor.
        
        Args:
            output_dir: Directory to save violation images and data
        """
        self.detector = ViolationDetector()
        self.analyzer = TrafficAnalyzer()
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Thread control
        self._stop_event = threading.Event()
        self._thread = None
        self._stream = None
        self._callbacks = {
            'violation': [],
            'vehicle_count': [],
            'frame_processed': []
        }
        
        # State
        self.frame_count = 0
        self.processing_fps = 0
        self.last_update_time = time.time()
        self.last_frame = None
        self.current_vehicles = 0
        self.current_violations = {}
    
    def register_callback(self, event_type: str, callback: Callable):
        """Register a callback for processing events."""
        if event_type in self._callbacks:
            self._callbacks[event_type].append(callback)
    
    def _trigger_callbacks(self, event_type: str, data: Dict):
        """Trigger all registered callbacks for an event."""
        for callback in self._callbacks.get(event_type, []):
            try:
                callback(data)
            except Exception as e:
                logger.error(f"Error in {event_type} callback: {str(e)}")
    
    def start_processing(self, source: str):
        """
        Start processing video from the given source.
        
        Args:
            source: Video source (RTSP URL, file path, or camera index)
        """
        if self._thread and self._thread.is_alive():
            logger.warning("Processing is already running")
            return False
            
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._process_stream,
            args=(source,),
            daemon=True
        )
        self._thread.start()
        return True
    
    def stop_processing(self):
        """Stop the video processing thread."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5.0)
        if self._stream and self._stream.isOpened():
            self._stream.release()
    
    def _process_stream(self, source: str):
        """Process video stream in a separate thread."""
        try:
            # Open the video source
            if source.isdigit():
                source = int(source)  # Camera index
                
            self._stream = cv2.VideoCapture(source)
            if not self._stream.isOpened():
                logger.error(f"Failed to open video source: {source}")
                return
                
            logger.info(f"Started processing video from: {source}")
            frame_count = 0
            start_time = time.time()
            
            while not self._stop_event.is_set():
                ret, frame = self._stream.read()
                if not ret:
                    logger.warning("Failed to read frame from source")
                    time.sleep(1)  # Avoid tight loop on error
                    continue
                
                # Process the frame
                processed_frame, results = self._process_frame(frame)
                self.last_frame = processed_frame
                frame_count += 1
                
                # Update FPS every second
                elapsed = time.time() - start_time
                if elapsed >= 1.0:
                    self.processing_fps = frame_count / elapsed
                    frame_count = 0
                    start_time = time.time()
                
                # Small delay to prevent 100% CPU usage
                time.sleep(0.01)
                
        except Exception as e:
            logger.error(f"Error in video processing thread: {str(e)}")
        finally:
            if self._stream and self._stream.isOpened():
                self._stream.release()
            logger.info("Video processing stopped")
    
    def _process_frame(self, frame: np.ndarray) -> tuple:
        """Process a single video frame."""
        # Make a copy of the frame for processing
        processed_frame = frame.copy()
        
        # Detect vehicles and violations
        vehicles = self.detector.detect_vehicles(processed_frame)
        violations = self.detector.detect_violations(processed_frame)
        
        # Update traffic analyzer
        self.analyzer.update_vehicle_count(len(vehicles))
        
        # Process violations
        self._handle_violations(violations, processed_frame)
        
        # Draw detections on frame
        self._draw_detections(processed_frame, vehicles, violations)
        
        # Update state
        self.current_vehicles = len(vehicles)
        self.current_violations = {
            'no_helmet': len(violations['no_helmet']),
            'no_seatbelt': len(violations['no_seatbelt']),
            'triple_riding': len(violations['triple_riding']),
            'wrong_way': len(violations['wrong_way'])
        }
        
        # Trigger callbacks
        self._trigger_callbacks('frame_processed', {
            'frame': processed_frame,
            'vehicles': vehicles,
            'violations': violations,
            'timestamp': datetime.now().isoformat()
        })
        
        return processed_frame, {'vehicles': vehicles, 'violations': violations}
    
    def _handle_violations(self, violations: Dict, frame: np.ndarray):
        """Handle detected violations (save images, trigger alerts, etc.)."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Process each type of violation
        for violation_type, violation_list in violations.items():
            if not violation_list:
                continue
                
            for i, violation in enumerate(violation_list):
                # Extract vehicle region
                bbox = violation.get('vehicle_bbox', violation['bbox'])
                x1, y1, x2, y2 = bbox
                vehicle_img = frame[y1:y2, x1:x2]
                
                if vehicle_img.size == 0:
                    continue
                
                # Generate a unique ID for this violation
                violation_id = f"{timestamp}_{violation_type}_{i}"
                
                # Save violation image
                img_path = self.output_dir / f"{violation_id}.jpg"
                cv2.imwrite(str(img_path), vehicle_img)
                
                # Try to detect license plate
                plate_info = None
                if 'vehicle_bbox' in violation:
                    plate_info = self.detector.detect_license_plate(frame, violation['vehicle_bbox'])
                
                # Prepare violation data
                violation_data = {
                    'id': violation_id,
                    'type': violation_type,
                    'timestamp': datetime.now().isoformat(),
                    'image_path': str(img_path),
                    'confidence': violation.get('confidence', 0.0),
                    'bbox': violation['bbox'],
                    'plate_info': plate_info
                }
                
                # Save violation metadata
                with open(self.output_dir / f"{violation_id}.json", 'w') as f:
                    json.dump(violation_data, f, indent=2)
                
                # Trigger violation callback
                self._trigger_callbacks('violation', violation_data)
    
    def _draw_detections(self, frame: np.ndarray, vehicles: List[Dict], violations: Dict):
        """Draw detection and violation bounding boxes on the frame."""
        # Draw vehicle detections
        for vehicle in vehicles:
            x1, y1, x2, y2 = vehicle['bbox']
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                frame, 
                f"{vehicle['class_name']} {vehicle['confidence']:.2f}",
                (x1, y1 - 10), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.5, 
                (0, 255, 0), 
                2
            )
        
        # Draw violations with different colors
        violation_colors = {
            'no_helmet': (0, 0, 255),      # Red
            'no_seatbelt': (255, 0, 0),    # Blue
            'triple_riding': (0, 165, 255),# Orange
            'wrong_way': (255, 0, 255)     # Magenta
        }
        
        for violation_type, violation_list in violations.items():
            if not violation_list:
                continue
                
            color = violation_colors.get(violation_type, (0, 0, 0))
            
            for violation in violation_list:
                # Draw vehicle bbox for violations with vehicle context
                bbox = violation.get('vehicle_bbox', violation['bbox'])
                x1, y1, x2, y2 = bbox
                
                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                
                # Draw label
                label = f"{violation_type.replace('_', ' ').title()} ({violation.get('confidence', 0):.2f})"
                cv2.putText(
                    frame, 
                    label,
                    (x1, y1 - 20), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.6, 
                    color, 
                    2
                )
                
                # If this is a person violation (like no-helmet), draw person bbox
                if 'rider_bbox' in violation:
                    rx1, ry1, rx2, ry2 = violation['rider_bbox']
                    cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), (0, 255, 255), 2)
    
    def get_status(self) -> Dict:
        """Get current status of the video processor."""
        return {
            'is_running': self._thread and self._thread.is_alive(),
            'fps': self.processing_fps,
            'frame_count': self.frame_count,
            'current_vehicles': self.current_vehicles,
            'current_violations': self.current_violations,
            'traffic_density': self.analyzer.get_traffic_density(),
            'predicted_congestion': self.analyzer.predict_congestion()
        }

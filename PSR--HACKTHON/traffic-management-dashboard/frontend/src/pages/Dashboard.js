import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import TrafficIcon from '@mui/icons-material/Traffic';
import WarningIcon from '@mui/icons-material/WarningAmber';
import TimelineIcon from '@mui/icons-material/Timeline';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import axios from 'axios';
import TrafficChart from '../components/dashboard/TrafficChart';
import ViolationTypesChart from '../components/dashboard/ViolationTypesChart';
import CameraFeed from '../components/dashboard/CameraFeed';
import AlertFeed from '../components/dashboard/AlertFeed';

const StatCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  height: '100%',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[8],
  },
}));

const StatIcon = styled('div')(({ theme, color }) => ({
  width: 60,
  height: 60,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette[color].light,
  color: theme.palette[color].main,
  '& svg': {
    fontSize: 30,
  },
}));

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalVehicles: 0,
    violations: 0,
    avgSpeed: 0,
    congestionLevel: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real app, this would be an API call to your backend
        // const response = await axios.get('/api/traffic/summary');
        // setStats(response.data);
        
        // Mock data for now
        setTimeout(() => {
          setStats({
            totalVehicles: 1245,
            violations: 28,
            avgSpeed: 42,
            congestionLevel: 65,
          });
          setLoading(false);
        }, 1000);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    };

    fetchData();
    
    // Set up polling
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Vehicles',
      value: stats.totalVehicles.toLocaleString(),
      icon: <TrafficIcon />,
      color: 'primary',
      trend: '+5.2%',
    },
    {
      title: 'Violations Today',
      value: stats.violations,
      icon: <WarningIcon />,
      color: 'error',
      trend: '-2.1%',
    },
    {
      title: 'Avg. Speed',
      value: `${stats.avgSpeed} km/h`,
      icon: <TimelineIcon />,
      color: 'success',
      trend: '+1.8%',
    },
    {
      title: 'Congestion Level',
      value: `${stats.congestionLevel}%`,
      icon: <GpsFixedIcon />,
      color: 'warning',
      trend: '-3.4%',
    },
  ];

  if (loading) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Traffic Management Dashboard
      </Typography>
      
      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard elevation={3}>
              <StatIcon color={stat.color}>{stat.icon}</StatIcon>
              <Typography variant="h5" component="div" gutterBottom>
                {stat.value}
              </Typography>
              <Typography variant="subtitle2" color="textSecondary" align="center">
                {stat.title}
              </Typography>
              <Typography 
                variant="caption" 
                color={stat.trend.startsWith('+') ? 'success.main' : 'error.main'}
                sx={{ mt: 1 }}
              >
                {stat.trend} from last hour
              </Typography>
            </StatCard>
          </Grid>
        ))}
      </Grid>
      
      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Traffic Flow Analysis
            </Typography>
            <TrafficChart />
          </Paper>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Violation Types
                </Typography>
                <ViolationTypesChart />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Live Camera Feed
                </Typography>
                <CameraFeed />
              </Paper>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Right Column */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Alerts
            </Typography>
            <AlertFeed />
          </Paper>
          
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Traffic Light Status
            </Typography>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{ 
                width: 100, 
                height: 100, 
                borderRadius: '50%', 
                backgroundColor: 'success.main',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                boxShadow: '0 0 20px rgba(0,0,0,0.2)',
                mb: 2
              }}>
                32s
              </Box>
              <Typography>Intersection #1 - Main St & 1st Ave</Typography>
              <Typography variant="body2" color="textSecondary">
                Next change in 12 seconds
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

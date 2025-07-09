import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import EventNoteIcon from '@mui/icons-material/EventNote';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({
    pets: { count: 0, loading: true, error: null },
    hospitals: { count: 0, loading: true, error: null },
    doctors: { count: 0, loading: true, error: null },
    visits: { count: 0, loading: true, error: null },
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const petsResponse = await axios.get('/api/pets');
        setStats(prev => ({
          ...prev,
          pets: { count: petsResponse.data.length, loading: false, error: null }
        }));
      } catch (err) {
        setStats(prev => ({
          ...prev,
          pets: { count: 0, loading: false, error: 'Failed to fetch pets' }
        }));
      }

      try {
        const hospitalsResponse = await axios.get('/api/hospitals');
        setStats(prev => ({
          ...prev,
          hospitals: { count: hospitalsResponse.data.length, loading: false, error: null }
        }));
      } catch (err) {
        setStats(prev => ({
          ...prev,
          hospitals: { count: 0, loading: false, error: 'Failed to fetch hospitals' }
        }));
      }

      try {
        const doctorsResponse = await axios.get('/api/doctors');
        setStats(prev => ({
          ...prev,
          doctors: { count: doctorsResponse.data.length, loading: false, error: null }
        }));
      } catch (err) {
        setStats(prev => ({
          ...prev,
          doctors: { count: 0, loading: false, error: 'Failed to fetch doctors' }
        }));
      }

      try {
        const visitsResponse = await axios.get('/api/visits');
        setStats(prev => ({
          ...prev,
          visits: { count: visitsResponse.data.length, loading: false, error: null }
        }));
      } catch (err) {
        setStats(prev => ({
          ...prev,
          visits: { count: 0, loading: false, error: 'Failed to fetch visits' }
        }));
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Pets',
      icon: <PetsIcon sx={{ fontSize: 40 }} />,
      count: stats.pets.count,
      loading: stats.pets.loading,
      error: stats.pets.error,
      link: '/pets',
      color: '#3f51b5',
    },
    {
      title: 'Hospitals',
      icon: <LocalHospitalIcon sx={{ fontSize: 40 }} />,
      count: stats.hospitals.count,
      loading: stats.hospitals.loading,
      error: stats.hospitals.error,
      link: '/hospitals',
      color: '#f50057',
    },
    {
      title: 'Doctors',
      icon: <PersonIcon sx={{ fontSize: 40 }} />,
      count: stats.doctors.count,
      loading: stats.doctors.loading,
      error: stats.doctors.error,
      link: '/doctors',
      color: '#00bcd4',
    },
    {
      title: 'Visits',
      icon: <EventNoteIcon sx={{ fontSize: 40 }} />,
      count: stats.visits.count,
      loading: stats.visits.loading,
      error: stats.visits.error,
      link: '/visits',
      color: '#4caf50',
    },
  ];

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <Paper
              elevation={3}
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: 140,
                borderTop: `4px solid ${card.color}`,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" component="h2">
                  {card.title}
                </Typography>
                <Box sx={{ color: card.color }}>{card.icon}</Box>
              </Box>
              <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {card.loading ? (
                  <CircularProgress size={30} />
                ) : card.error ? (
                  <Typography color="error" variant="body2">Error loading data</Typography>
                ) : (
                  <Typography variant="h3">{card.count}</Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Button
                  component={RouterLink}
                  to={card.link}
                  size="small"
                  color="primary"
                >
                  View All
                </Button>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No recent activities at the moment.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Button
                    component={RouterLink}
                    to="/pets"
                    variant="outlined"
                    fullWidth
                    startIcon={<PetsIcon />}
                  >
                    Add Pet
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    component={RouterLink}
                    to="/visits"
                    variant="outlined"
                    fullWidth
                    startIcon={<EventNoteIcon />}
                  >
                    Schedule Visit
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    component={RouterLink}
                    to="/doctors"
                    variant="outlined"
                    fullWidth
                    startIcon={<PersonIcon />}
                  >
                    Add Doctor
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    component={RouterLink}
                    to="/billing"
                    variant="outlined"
                    fullWidth
                  >
                    Create Invoice
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;

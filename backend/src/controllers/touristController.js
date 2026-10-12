import { db } from '../database/db.js';
import { aiPlannerService } from '../services/aiPlannerService.js';
import { recommendationService } from '../services/recommendationService.js';
import { sentimentService } from '../services/sentimentService.js';

export const touristController = {
  completeBooking(req, res) {
    try {
      const bookingId = String(req.params.bookingId || '').trim();
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Booking ID is required.' });
      }
      const booking = db.bookings.findById(bookingId);
      if (!booking || booking.user_id !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Booking not found.' });
      }
      if (booking.status === 'completed') {
        return res.status(409).json({ success: false, message: 'This journey has already been completed.' });
      }
      if (booking.status !== 'confirmed') {
        return res.status(409).json({ success: false, message: 'Only confirmed bookings can be completed.' });
      }
      if (!booking.check_out_date) {
        return res.status(409).json({ success: false, message: 'This booking has no scheduled end date.' });
      }

      const today = new Date().toISOString().slice(0, 10);
      if (String(booking.check_out_date).slice(0, 10) > today) {
        return res.status(409).json({ success: false, message: 'This journey has not reached its scheduled end date.' });
      }

      const updated = db.bookings.completeIfEligible(bookingId, req.user.id, today);
      if (!updated) {
        return res.status(409).json({ success: false, message: 'The booking could not be completed in its current state.' });
      }
      return res.json({
        success: true,
        message: 'Journey marked as completed.',
        booking: updated,
        status: updated.status,
        completedAt: updated.settled_at
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async getDashboard(req, res) {
    try {
      const touristId = req.user.id;
      const user = db.users.findById(touristId);
      const profile = db.touristProfiles.findByUserId(touristId);
      const bookings = db.bookings.findByUserId(touristId);
      const reviews = db.reviews.listAll()
        .filter(r => r.user_id === touristId)
        .map((review) => sentimentService.refreshStoredAspectAnalysis(review));
      const favourites = db.favourites.listByUser(touristId);
      const notifications = db.notifications.findByUserId(touristId);

      // Recommendations based on user profile preferences
      const preferences = profile || {};
      const recommendations = await aiPlannerService.generateItinerary({
        days: preferences.travel_duration || 3,
        budget: preferences.budget || 25000,
        interests: preferences.interests || [],
        startCity: preferences.starting_location || 'Ranchi'
      });
      const personalizedRecommendations = recommendationService.getRecommendations({
        ...preferences,
        limit: 6
      });

      const activeTrips = bookings.filter(b => b.status === 'confirmed').length;
      const completedTrips = bookings.filter(b => b.status === 'completed').length;
      const totalSpent = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

      res.json({
        success: true,
        tourist: {
          id: touristId,
          name: user?.name,
          email: user?.email,
          phone: user?.phone,
          preferences: profile
        },
        stats: {
          activeTrips,
          completedTrips,
          totalSpent,
          reviewsSubmitted: reviews.length,
          savedCount: favourites.length
        },
        bookings,
        reviews,
        favourites,
        notifications,
        recommendations: recommendations.days || [],
        personalizedRecommendations
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updatePreferences(req, res) {
    try {
      const touristId = req.user.id;
      const { budget, travelDuration, interests, startingLocation, groupSize, groupType, bio } = req.body;
      const existing = db.touristProfiles.findByUserId(touristId) || {};
      const normalizedGroupType = String(groupType || 'couple').toLowerCase().trim();
      const groupTypeAliases = {
        'solo traveler': 'solo',
        'solo': 'solo',
        'couple': 'couple',
        'family': 'family',
        'group': 'group'
      };

      const updated = db.touristProfiles.upsert({
        user_id: touristId,
        budget: budget === undefined ? existing?.budget || 25000 : Number(budget) || 25000,
        travel_duration: travelDuration === undefined ? existing?.travel_duration || 3 : Number(travelDuration) || 3,
        interests: interests === undefined ? existing?.interests || [] : interests,
        starting_location: startingLocation === undefined ? existing?.starting_location || 'Ranchi' : startingLocation,
        group_size: groupSize === undefined ? existing?.group_size || 2 : Number(groupSize) || 2,
        group_type: groupType === undefined ? existing?.group_type || 'couple' : (groupTypeAliases[normalizedGroupType] || 'couple'),
        bio: bio === undefined ? existing?.bio || '' : bio
      });

      res.json({ success: true, message: 'Preferences updated.', preferences: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  toggleFavourite(req, res) {
    try {
      const touristId = req.user.id;
      const { targetType, targetId } = req.body;
      if (!targetType || !targetId) {
        return res.status(400).json({ success: false, message: 'targetType and targetId are required.' });
      }

      const result = db.favourites.toggle(touristId, targetType, targetId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  getFavourites(req, res) {
    try {
      const touristId = req.user.id;
      const favourites = db.favourites.listByUser(touristId);
      res.json({ success: true, count: favourites.length, favourites });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

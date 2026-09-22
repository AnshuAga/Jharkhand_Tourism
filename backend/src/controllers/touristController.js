import { db } from '../database/db.js';
import { aiPlannerService } from '../services/aiPlannerService.js';

export const touristController = {
  async getDashboard(req, res) {
    try {
      const touristId = req.user.id;
      const user = db.users.findById(touristId);
      const profile = db.touristProfiles.findByUserId(touristId);
      const bookings = db.bookings.findByUserId(touristId);
      const reviews = db.reviews.listAll().filter(r => r.user_id === touristId);
      const favourites = db.favourites.listByUser(touristId);
      const notifications = db.notifications.findByUserId(touristId);

      // Recommendations based on user profile preferences
      const preferences = profile || { interests: ['nature'], budget: 25000, travel_duration: 3 };
      const recommendations = await aiPlannerService.generateItinerary({
        days: preferences.travel_duration || 3,
        budget: preferences.budget || 25000,
        interests: preferences.interests || ['nature'],
        startCity: preferences.starting_location || 'Ranchi'
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
        recommendations: recommendations.days || []
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updatePreferences(req, res) {
    try {
      const touristId = req.user.id;
      const { budget, travelDuration, interests, startingLocation, groupSize, groupType, bio } = req.body;
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
        budget: Number(budget) || 25000,
        travel_duration: Number(travelDuration) || 3,
        interests: interests || ['nature'],
        starting_location: startingLocation || 'Ranchi',
        group_size: Number(groupSize) || 2,
        group_type: groupTypeAliases[normalizedGroupType] || 'couple',
        bio: bio || ''
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

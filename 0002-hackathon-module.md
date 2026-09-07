- Admins create, update and deleter hackathons
- Anyone can browse them
- Participants can join active ones
- We track who joined which hackathon and when

## Prisma schemas

Create a Hackathon and HackathonParticipant schema

Hackathon has: name, description (optional), start/end dates,
isActive, and belongs to a User author.

HackathonParticipant tracks which user joined which hackathon with a unique constraint on hackathonId + userId

run db:format, db:migrate and db:generate
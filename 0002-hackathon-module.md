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

## Global validation

Install class-validator and class-transformer.
Setup the global validation pipe in main.ts that returns clean 
validation errors as an array of {property, message} objects
using BadRequest exception.

## DTOs

Create a CreateHackathonDto with:
- name (min 3 chars)
- description (optional) (min 10 chars, max 1000 chars)
- startsAt and endsAt as future dates
- isActive optional boolean
Use @Type(() => Date) to transform date strings

## Resource

build the hackathons crud service and controller

use auth guards and roles from nestjs-better-auth package

add a response message on write operations
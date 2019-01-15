/* global fetch */
import React, { Component } from 'react'
import Helmet from 'react-helmet'
import moment from 'moment'
import cn from 'classnames'
import './App.css'
import Main from './components/Main/Main'
import Event from './components/Event/Event'
import BookNow from './components/BookNow/BookNow'
import CheckIn from './components/CheckIn/CheckIn'
import CheckOut from './components/CheckOut/CheckOut'
import PropTypes from 'prop-types'

// FIXME: #1 This should be here duplicated :(
const unifySchedule = function (events) {
  let now = moment()
  events = events.filter((e) => !e.available)
  let busySlots = events.slice()
  let freeSlots = getFreeSlots(events, now)

  let schedule = busySlots.concat(freeSlots).sort((a, b) => a.start - b.start)

  return schedule
}

// FIXME: #2 This should be here duplicated :(
const getFreeSlots = function (events, now) {
  // Add two fake bookings at the start and end of the day to easily get the slots in between all the events
  events = events.slice().sort((a, b) => a.start - b.start)
  events.unshift({ start: now.clone().startOf('day'), end: now.clone().startOf('day') })
  events.push({ start: now.clone().endOf('day'), end: now.clone().endOf('day') })

  let slots = []
  for (let i = 0; i < events.length; i++) {
    let current = events[i]
    let next = events[i + 1] || events[events.length - 1]

    if (current.status !== 'cancelled') {
      current.end = moment(current.end)
      let containingEvent = events.filter((e) => current.end.isBetween(e.start, e.end)).sort((a, b) => a.end - b.end).pop() || null
      if (containingEvent) { current = containingEvent }

      if (next.start - current.end > 0) {
        slots.push({
          start: current.end.clone(),
          end: next.start.clone(),
          summary: 'Free',
          organizer: null,
          available: true,
          private: false
        })
      }
    }
  }

  return slots
}

const FLASH_MEETING_SUMMARY = 'Flash meeting'

export default class App extends Component {
  constructor (props) {
    super(props)

    this.state = {
      name: '',
      slug: props.match.params.room,
      now: moment(),
      schedule: [],
      isLoading: true,
      isAvailable: false,
      currentEvent: null,
      nextEvent: null,
      nextFreeSlot: null,
      isEventChecked: null,
      isCheckInOpen: null,
      endIsLoading: false
    }
  }

  componentWillMount () {
    this.fetchSchedule()
    this.fetchInterval = setInterval(() => this.fetchSchedule(), 30 * 1000)
    this.updateInterval = setInterval(() => this.updateTime(), 1 * 1000)
  }

  componentWillUnmount () {
    clearInterval(this.fetchInterval)
    clearInterval(this.updateInterval)
  }

  fetchSchedule = () => {
    fetch(`/api/rooms/${this.state.slug}`)
      .then(response => response.json())
      .then(({ name, schedule }) => this.setState({ name, schedule }, this.updateTime))
  }

  book = () => {
    let { now, schedule } = this.state
    let freeSlot = schedule.find((s) => now.isBetween(s.start, s.end) && s.available)
    let newEvent = {
      start: now.startOf('minute'),
      end: moment.min(now.clone().add(15, 'minute'), moment(freeSlot.end)),
      summary: FLASH_MEETING_SUMMARY
    }
    schedule.push(newEvent)

    let isEventChecked = newEvent
    let isCheckInOpen = false

    schedule = unifySchedule(schedule)

    this.setState({ schedule, isEventChecked, isCheckInOpen }, this.updateTime)

    fetch(`/api/rooms/${this.state.slug}`, { method: 'POST' })
      .then(response => response.json())
      .then(({ name, schedule }) => this.setState({ name, schedule }, this.updateTime))
  }
  
  checkin = () => {
    const isEventChecked = this.state.currentEvent
    const isCheckInOpen = false
    this.setState({isEventChecked, isCheckInOpen})
  }

  checkout = (room, event) => {
    let currentEvent = this.state.currentEvent
    if (currentEvent.id) {
      this.setState({
        endIsLoading: true
      })
      fetch(`/api/end/${this.state.slug}/${currentEvent.id}`, { method: 'POST' })
        .then(() => {
          this.fetchSchedule()
          this.setState({
            endIsLoading: false
          })
        })
    } else {
      this.fetchSchedule()
    }
  }

  removeEvent = (room, event) => {
    fetch(`/api/rooms/${this.state.slug}/${event.id}`, { method: 'DELETE' })
      .then(() => this.fetchSchedule())
  }

  // TODO: Clean up App's updateTime method
  updateTime () {
    let { schedule, isEventChecked, currentEvent, isAvailable, isLoading, isCheckInOpen } = this.state
    const now = moment()
    const nextEvent = schedule.find(slot => !slot.available && now.isBefore(slot.start)) || null
    const nextFreeSlot = schedule.find(slot => slot.available && now.isBefore(slot.start)) || null
    
    currentEvent = schedule.find(slot => now.isBetween(slot.start, slot.end)) || null
    // If there's no current event, something's probably wrong or we went into the next day
    isAvailable = currentEvent ? currentEvent.available : false
    isLoading = !currentEvent

    // Reset isEventChecked flag for the next event
    if (currentEvent && isEventChecked && !moment(currentEvent.start).isSame(isEventChecked.start)) {
      isEventChecked = null
    }

    isCheckInOpen = !!(currentEvent && !currentEvent.available && !isEventChecked && schedule.find(slot => now.isBetween(slot.start, moment(slot.start).add(15, 'minute'))))

    if (currentEvent && !isEventChecked && !isCheckInOpen && !isAvailable) {
      this.removeEvent(this.state.slug, currentEvent)
    }
    this.setState({ now, isLoading, isAvailable, currentEvent, nextEvent, nextFreeSlot, isEventChecked, isCheckInOpen })
  }

  render () {
    const { name, now, isLoading, isAvailable, currentEvent, nextEvent, nextFreeSlot, isCheckInOpen, isEventChecked } = this.state
    const state = isAvailable ? 'free' : 'busy'

    let minutesLeft, timeLeft
    let mainProps = { label: state }
    let eventProps = {}
    let isFlashMeeting = currentEvent && currentEvent.summary === FLASH_MEETING_SUMMARY

    // Define what event info is shown and the total time left
    if (isAvailable && nextEvent) {
      minutesLeft = Math.ceil(moment.duration(-now.diff(currentEvent.end)).asMinutes())
      eventProps = { current: false, event: nextEvent }
      timeLeft = currentEvent.end
    } else if (!isAvailable) {
      let endEvent = nextEvent || (nextFreeSlot || now.endOf('day'))
      minutesLeft = Math.ceil(moment.duration(-now.diff(endEvent.start)).asMinutes())
      timeLeft = nextFreeSlot ? moment(nextFreeSlot.start) : now.endOf('day')
      if (currentEvent) {
        eventProps = { current: true, event: currentEvent }
      }
    }

    // No/Distant event - Only shows the state of the room
    if (minutesLeft >= 120 || (isAvailable && !minutesLeft)) {
      mainProps = { time: state }
      eventProps = {}
    } else { // Near event - Shows more detailed info about the state and current/next Event
      mainProps = {
        label: mainProps.label + (minutesLeft >= 30 ? ' until' : ' for'),
        time: minutesLeft >= 30 ? moment(timeLeft).format('HH:mm') : ` ${minutesLeft}'`
      }
    }
    const shouldDisplayCheckin = isCheckInOpen && !isAvailable && !isFlashMeeting
    const shouldDisplayCheckout = (isEventChecked || isFlashMeeting) && !isAvailable
    return (
      !isLoading ? (
        <div className={cn('App', state)}>
          <Helmet>
            <title>{name}</title>
            <link rel="icon" type="image/x-icon" href={`/${state}.ico`} />
          </Helmet>
          <Main {...mainProps}>
            {isAvailable && <BookNow book={this.book} />}
            {shouldDisplayCheckin && <CheckIn checkin={this.checkin} />}
            {shouldDisplayCheckout && <CheckOut disabled={this.state.endIsLoading} checkout={this.checkout} />}
          </Main>
          <Event {...eventProps} />
        </div>
      ) : null
    )
  }
}

App.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      room: PropTypes.string.isRequired
    })
  })
}

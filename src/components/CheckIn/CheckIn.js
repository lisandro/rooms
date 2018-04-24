import React, { Component } from 'react'
import PropTypes from 'prop-types'

import './CheckIn.css'

export default class CheckIn extends Component {
  static propTypes = {
    checkin: PropTypes.func
  }

  static defaultProps = {
    checkin: () => { }
  }

  render () {
    const { checkin } = this.props

    return (
      <button className="CheckIn" onClick={checkin}>Check In</button>
    )
  }
}

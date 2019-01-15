import React, { Component } from 'react'
import PropTypes from 'prop-types'

import './CheckOut.css'

export default class CheckOut extends Component {
  static propTypes = {
    checkout: PropTypes.func,
    disabled: PropTypes.bool
  }

  static defaultProps = {
    checkout: () => { },
    disabled: false
  }

  render () {
    const { checkout, disabled } = this.props

    return (
      <button className="CheckOut" disabled={disabled ? 'disabled' : ''} onClick={checkout}>END MEETING</button>
    )
  }
}

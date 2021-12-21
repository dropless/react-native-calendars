// @flow
import min from 'lodash/min';
import map from 'lodash/map';
import invoke from 'lodash/invoke';
import PropTypes from 'prop-types';
import XDate from 'xdate';

import React, {Component} from 'react';
import {View, Text, TouchableOpacity, Dimensions, ScrollView, TextStyle, ViewStyle} from 'react-native';

import {Theme} from '../types';
import styleConstructor from './style';
import populateEvents from './Packer';

const LEFT_MARGIN = 60 - 1;
const TEXT_LINE_HEIGHT = 17;

function range(from: number, to: number) {
  return Array.from(Array(to), (_, i) => from + i);
}

let {width: dimensionWidth} = Dimensions.get('window');

export type Event = {
  start: string;
  end: string;
  title: string;
  summary?: string;
  color?: string;
  disabled?: boolean;
};

export interface TimelineProps {
  workingHours?: Event[];
  backgroundEvents?: Event[];
  events: Event[];
  start?: number;
  end?: number;
  eventTapped?: (event: Event) => void; //TODO: deprecate (prop renamed 'onEventPress', as in the other components).
  onEventPress?: (event: Event) => void;
  styles?: Theme; //TODO: deprecate (prop renamed 'theme', as in the other components).
  theme?: Theme;
  scrollToFirst?: boolean;
  format24h?: boolean;
  renderEvent?: (event: Event) => JSX.Element;
  scrollToCurrent?: boolean;
  showCurrentMarker?: boolean;
  renderCurrentMarker?: () => JSX.Element;
}

interface State {
  packedWorkingHours: Event[];
  packedBackgroundEvents: Event[];
  packedEvents: Event[];
}

export default class Timeline extends Component<TimelineProps, State> {
  static propTypes = {
    start: PropTypes.number,
    end: PropTypes.number,
    eventTapped: PropTypes.func, // TODO: remove after deprecation
    onEventPress: PropTypes.func,
    format24h: PropTypes.bool,
    workingHours: PropTypes.arrayOf(
      PropTypes.shape({
        start: PropTypes.string.isRequired,
        end: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired
      })
    ),
    backgroundEvents: PropTypes.arrayOf(
      PropTypes.shape({
        start: PropTypes.string.isRequired,
        end: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired
      })
    ),
    events: PropTypes.arrayOf(
      PropTypes.shape({
        start: PropTypes.string.isRequired,
        end: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        summary: PropTypes.string.isRequired,
        color: PropTypes.string
      })
    ).isRequired
  };

  static defaultProps = {
    start: 0,
    end: 24,
    events: [],
    format24h: true
  };

  private scrollView: React.RefObject<any> = React.createRef();
  style: {[key: string]: ViewStyle | TextStyle};
  calendarHeight: number;

  constructor(props: TimelineProps) {
    super(props);

    const {start = 0, end = 0} = this.props;
    this.calendarHeight = (end - start) * 100;

    this.style = styleConstructor(props.theme || props.styles, this.calendarHeight);

    const width = dimensionWidth - LEFT_MARGIN;
    const packedWorkingHours = populateEvents(props.workingHours ?? [], width, start);
    const packedBackgroundEvents = populateEvents(props.backgroundEvents ?? [], width, start);
    const packedEvents = populateEvents(props.events, width, start);

    this.state = {
      packedWorkingHours,
      packedBackgroundEvents,
      packedEvents
    };
  }

  componentDidMount() {
    const {events, scrollToCurrent, scrollToFirst} = this.props;
    if (events.length === 0 && scrollToCurrent) this.scrollToCurrent();
    else if (events.length > 0 && scrollToFirst) this.scrollToFirst();
  }

  componentDidUpdate(prevProps: TimelineProps) {
    const width = dimensionWidth - LEFT_MARGIN;
    const {
      events: prevEvents,
      backgroundEvents: prevBackgroundEvents,
      workingHours: prevWorkingHours,
      start: prevStart = 0
    } = prevProps;
    const {events, backgroundEvents, workingHours, start = 0} = this.props;

    const eventsChanged = prevEvents !== events;
    const backgroundEventsChanged = prevBackgroundEvents !== backgroundEvents;
    const workingHoursChanged = prevWorkingHours !== workingHours;
    const startChanged = prevStart !== start;

    if (eventsChanged || backgroundEventsChanged || workingHoursChanged || startChanged) {
      this.setState({
        packedWorkingHours: populateEvents(workingHours ?? [], width, start),
        packedBackgroundEvents: populateEvents(backgroundEvents ?? [], width, start),
        packedEvents: populateEvents(events, width, start)
      });
    }
  }

  scrollToFirst() {
    const {packedEvents} = this.state;
    const {start = 0, end = 0} = this.props;
    const firstEventPosition = min(map(packedEvents, 'top')) - this.calendarHeight / (end - start);

    setTimeout(() => {
      if (this.state && firstEventPosition && this.scrollView) {
        this.scrollView?.current?.scrollTo({
          x: 0,
          y: firstEventPosition,
          animated: true
        });
      }
    }, 100);
  }

  scrollToCurrent() {
    const currentTimePosition = this.calendarHeight * this.getCurrentPercentage() - 10;

    setTimeout(() => {
      if (this.state && currentTimePosition && this.scrollView) {
        this.scrollView?.current?.scrollTo({
          x: 0,
          y: currentTimePosition,
          animated: true
        });
      }
    }, 1);
  }

  getCurrentPercentage() {
    const timeNow = new Date();
    const timeStart = new Date(timeNow);
    const difference = (timeNow.getTime() - timeStart.setHours(0, 0, 0, 0)) / 1000 / 60 / 60;
    return difference / 24;
  }

  _onEventPress(event: Event) {
    if (this.props.eventTapped) {
      //TODO: remove after deprecation
      this.props.eventTapped(event);
    } else {
      invoke(this.props, 'onEventPress', event);
    }
  }

  _renderWorkingHours() {
    const {packedWorkingHours} = this.state;
    let events = packedWorkingHours.map((event: any, i: number) => {
      const style = {
        left: event.left,
        height: event.height,
        width: event.width + LEFT_MARGIN + 20,
        top: event.top,
        backgroundColor: 'rgba(0,0,0,0.03)'
      };

      return <View key={i} style={[this.style.event, style]} />;
    });

    return (
      <View>
        <View>{events}</View>
      </View>
    );
  }

  _renderLines() {
    const {format24h, start = 0, end = 24} = this.props;
    const offset = this.calendarHeight / (end - start);
    const EVENT_DIFF = 20;

    return range(start, end + 1).map((i, index) => {
      let timeText;

      if (i === start) {
        timeText = '';
      } else if (i < 12) {
        timeText = !format24h ? `${i} AM` : `${i}:00`;
      } else if (i === 12) {
        timeText = !format24h ? `${i} PM` : `${i}:00`;
      } else if (i === 24) {
        timeText = !format24h ? '12 AM' : '23:59';
      } else {
        timeText = !format24h ? `${i - 12} PM` : `${i}:00`;
      }

      return [
        <Text key={`timeLabel${i}`} style={[this.style.timeLabel, {top: offset * index - 6}]}>
          {timeText}
        </Text>,
        i === start ? null : (
          <View key={`line${i}`} style={[this.style.line, {top: offset * index, width: dimensionWidth - EVENT_DIFF}]} />
        ),
        <View
          key={`lineHalf${i}`}
          style={[this.style.line, {top: offset * (index + 0.5), width: dimensionWidth - EVENT_DIFF}]}
        />
      ];
    });
  }

  _renderBackgroundEvents() {
    const {start = 0, end = 24} = this.props;
    const {packedBackgroundEvents} = this.state;
    const offset = this.calendarHeight / (end - start);

    let events = packedBackgroundEvents.map((event: any, i: number) => {
      const intervals = Math.ceil(event.height / offset);
      const style: ViewStyle = {
        left: event.left - 5,
        height: event.height,
        width: event.width + 10,
        top: event.top,
        backgroundColor: 'rgba(0,0,0,0.075)',
        borderWidth: 0,
        overflow: 'hidden'
      };

      const textStyle: TextStyle = {
        position: 'absolute',
        left: 10,
        marginTop: 10,
        color: '#6a6d76',
        fontWeight: '500'
      };

      return (
        <View key={i} style={[this.style.event, style]}>
          <View style={{padding: 8}}>
            {/* {new Array(intervals).fill(undefined).map((interval, i) => {
                const textStyle: TextStyle = { 
                  position: 'absolute',
                  left: 10,
                  marginTop: 10,
                  color: '#6a6d76',
                  fontWeight: "500",
                  top: offset * i,
                  opacity: 0.3,
                };

                return (
                  <Text key={i} numberOfLines={1} style={[this.style.eventTitle, textStyle]}>
                    {event.title || 'Event'}
                  </Text>
                  );
                })} */}
            <Text key={i} numberOfLines={1} style={[this.style.eventTitle, textStyle]}>
              {event.title || 'Event'}
            </Text>
          </View>
        </View>
      );
    });

    return (
      <View>
        <View style={{marginLeft: LEFT_MARGIN}}>{events}</View>
      </View>
    );
  }

  _renderEvents() {
    const {packedEvents} = this.state;
    let events = packedEvents.map((event: any, i: number) => {
      const style = {
        left: event.left,
        height: event.height,
        width: event.width,
        top: event.top,
        backgroundColor: event.color ? event.color : '#add8e6'
      };

      // Fixing the number of lines for the event title makes this calculation easier.
      // However it would make sense to overflow the title to a new line if needed
      const numberOfLines = Math.floor(event.height / TEXT_LINE_HEIGHT);
      const formatTime = this.props.format24h ? 'HH:mm' : 'hh:mm A';
      const current = this.props.events[event.index] ?? null;
      const disabled = current != null ? current.disabled : false;

      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => this._onEventPress(current)}
          key={i}
          disabled={disabled}
          style={[this.style.event, style]}
        >
          {this.props.renderEvent ? (
            this.props.renderEvent(event)
          ) : (
            <View>
              <Text numberOfLines={1} style={this.style.eventTitle}>
                {event.title || 'Event'}
              </Text>
              {numberOfLines > 1 ? (
                <Text numberOfLines={numberOfLines - 1} style={[this.style.eventSummary]}>
                  {event.summary || ' '}
                </Text>
              ) : null}
              {numberOfLines > 2 ? (
                <Text style={this.style.eventTimes} numberOfLines={1}>
                  {new XDate(event.start).toString(formatTime)} - {new XDate(event.end).toString(formatTime)}
                </Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      );
    });

    return (
      <View>
        <View style={{marginLeft: LEFT_MARGIN}}>{events}</View>
      </View>
    );
  }

  _renderCurrentMarker() {
    const percentage = this.getCurrentPercentage();
    const EVENT_DIFF = 40;

    return (
      <View style={{top: this.calendarHeight * percentage, left: EVENT_DIFF, width: dimensionWidth - EVENT_DIFF}}>
        {this.props.renderCurrentMarker ? (
          this.props.renderCurrentMarker()
        ) : (
          <View style={{height: 2, backgroundColor: 'red', width: '100%'}}></View>
        )}
      </View>
    );
  }

  render() {
    return (
      <ScrollView
        ref={this.scrollView}
        contentContainerStyle={[this.style.contentStyle, {width: dimensionWidth}]}
        nestedScrollEnabled
      >
        {this._renderWorkingHours()}
        {this._renderLines()}
        {this._renderBackgroundEvents()}
        {this._renderEvents()}
        {this.props.showCurrentMarker && this._renderCurrentMarker()}
      </ScrollView>
    );
  }
}

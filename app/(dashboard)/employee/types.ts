export interface ScheduleEvent {
  id: number;
  title: string;
  time: string;
  location: string;
  description?: string;
  date: string;
  userId: number;
}

export interface CalendarTheme {
  textDayFontSize: number;
  textDayFontWeight: string;
  textMonthFontSize: number;
  textMonthFontWeight: string;
  textDayHeaderFontSize: number;
  'stylesheet.calendar.header': {
    header: {
      flexDirection: 'row';
      justifyContent: 'space-between';
      paddingLeft: number;
      paddingRight: number;
      marginTop: number;
      alignItems: 'center';
    };
  };
} 
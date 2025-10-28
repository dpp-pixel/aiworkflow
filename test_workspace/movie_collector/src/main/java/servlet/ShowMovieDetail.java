package servlet;

import java.io.IOException;
import java.util.ArrayList;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import dao.MovieDAO;
import model.Member;
import model.Review;

@WebServlet("/movieDetail.do")
public class ShowMovieDetail extends HttpServlet {
	private static final long serialVersionUID = 1L;

	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		showMovieDetailController(request, response);
		//		response.getWriter().append("Served at: ").append(request.getContextPath());
	}

	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		showMovieDetailController(request, response);
		//		doGet(request, response);
	}

	protected void showMovieDetailController(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		MovieDAO dao = new MovieDAO();
		String movieCd = request.getParameter("movieCd");

		model.MovieDetail movie = dao.getDetail(movieCd);
		request.setAttribute("movie", movie);

		//내가 작성한 리뷰가 있는지 체크해서 전달
		HttpSession session = request.getSession();
		session.setAttribute("movieCd", movieCd);
		boolean isLogin = session.getAttribute("member") != null;
		request.setAttribute("isLogin", isLogin);

		Member nowUser = (Member) session.getAttribute("member");
		if (isLogin) {
			String e = String.valueOf(dao.getMyReviewExist(nowUser.getMember_seq()));
			request.setAttribute("myReviewExist", e);
		} else {
			request.setAttribute("myReviewExist", false);
		}
		//리뷰 데이터 가져옴
		ArrayList<Review> reviewList = dao.getReviewList(request.getParameter("movieCd"));
		for (int i = 0; i < reviewList.size(); i++) {
			if (isLogin && reviewList.get(i).getMember_seq() == nowUser.getMember_seq()) {
				Review myrev = reviewList.get(i);
				reviewList.remove(i);
				if (dao.getNickname(nowUser.getMember_seq()).length() != 0) {
					myrev.setWriter(dao.getNickname(nowUser.getMember_seq()));
				} else {
					myrev.setWriter(nowUser.getId());
				}
				request.setAttribute("myrev", myrev);
			} else {
				int memseq = reviewList.get(i).getMember_seq();
				String nick = dao.getNickname(memseq);
				if (nick.length() == 0) {
					reviewList.get(i).setWriter(dao.getId(memseq));
				} else {
					reviewList.get(i).setWriter(nick);
				}
			}
		}
		request.setAttribute("reviewList", reviewList);

		RequestDispatcher dis = request.getRequestDispatcher("movieDetail.jsp");
		dis.forward(request, response);
	}
}